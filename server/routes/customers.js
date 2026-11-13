import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num } from '../utils/format.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    const bid = scopedBranchId(user);
    const { page = 1, pageSize = 20, search, branch, occupation, minIncome, maxIncome, city } = req.query;
    const params = [];
    const where = ['1=1'];
    if (bid != null) { params.push(Number(bid)); where.push(`c.branch_id = $${params.length}`); }
    if (branch) { params.push(Number(branch)); where.push(`c.branch_id = $${params.length}`); }
    if (occupation) { params.push(occupation); where.push(`c.occupation = $${params.length}`); }
    if (city) { params.push(`%${city}%`); where.push(`c.city ILIKE $${params.length}`); }
    if (minIncome) { params.push(Number(minIncome)); where.push(`c.monthly_income >= $${params.length}`); }
    if (maxIncome) { params.push(Number(maxIncome)); where.push(`c.monthly_income <= $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(c.customer_id::text ILIKE $${params.length} OR c.name ILIKE $${params.length})`); }
    const whereSql = where.join(' AND ');

    const countRows = await q(`SELECT COUNT(*) c FROM customers c WHERE ${whereSql}`, params);
    const total = num(countRows[0].c);
    const offset = (Math.max(1, Number(page)) - 1) * Number(pageSize);
    params.push(Number(pageSize), offset);

    const customers = await q(
      `SELECT c.customer_id, c.name, c.age, c.city, c.occupation, c.monthly_income::float AS monthly_income,
              c.credit_score, c.status, c.branch_id, b.branch_name, c.created_at
       FROM customers c JOIN branches b ON b.branch_id = c.branch_id
       WHERE ${whereSql} ORDER BY c.customer_id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // enrich with account/loan/txn aggregates
    const ids = customers.map((c) => c.customer_id);
    const idSql = ids.join(',');
    const accMap = {};
    if (ids.length) {
      const accounts = await q(`SELECT account_id, customer_id, account_type, current_balance::float AS bal, status FROM accounts WHERE customer_id IN (${idSql})`);
      accounts.forEach((a) => {
        if (!accMap[a.customer_id]) accMap[a.customer_id] = [];
        accMap[a.customer_id].push(a);
      });
    }
    const loanMap = {};
    if (ids.length) {
      const loans = await q(`SELECT loan_id, customer_id, loan_status, outstanding_amount::float AS o FROM loans WHERE customer_id IN (${idSql})`);
      loans.forEach((l) => {
        if (!loanMap[l.customer_id]) loanMap[l.customer_id] = [];
        loanMap[l.customer_id].push(l);
      });
    }
    const txnMap = {};
    if (ids.length) {
      const txns = await q(`SELECT customer_id, COUNT(*) n FROM transactions WHERE customer_id IN (${idSql}) GROUP BY customer_id`);
      txns.forEach((t) => (txnMap[t.customer_id] = num(t.n)));
    }

    customers.forEach((c) => {
      const accs = accMap[c.customer_id] || [];
      const lns = loanMap[c.customer_id] || [];
      c.accounts = accs.length;
      c.account_type = accs[0] ? accs[0].account_type : null;
      c.balance = num((accs[0] || {}).bal || 0);
      c.activeLoans = lns.filter((l) => l.loan_status === 'Active' || l.loan_status === 'Overdue').length;
      c.outstandingLoan = num(lns.reduce((s, l) => s + num(l.o), 0));
      c.totalTransactions = txnMap[c.customer_id] || 0;
    });

    res.json({ customers, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = req.user;
    const id = Number(req.params.id);
    const bid = scopedBranchId(user);
    const params = [id];
    let sc = '';
    if (bid != null) { params.push(Number(bid)); sc = ' AND c.branch_id = $2'; }
    const rows = await q(
      `SELECT c.customer_id, c.name, c.age, c.city, c.occupation, c.monthly_income::float AS monthly_income,
              c.credit_score, c.status, c.branch_id, b.branch_name, c.created_at
       FROM customers c JOIN branches b ON b.branch_id = c.branch_id WHERE c.customer_id = $1${sc}`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    const customer = rows[0];

    const accounts = await q(
      `SELECT account_id, account_type, opening_balance::float AS opening_balance, current_balance::float AS current_balance, status, created_at
       FROM accounts WHERE customer_id = $1 ORDER BY account_id`,
      [id]
    );
    const loans = await q(
      `SELECT loan_id, loan_type, loan_amount::float AS loan_amount, interest_rate::float AS interest_rate, tenure_months,
              emi::float AS emi, amount_repaid::float AS amount_repaid, outstanding_amount::float AS outstanding_amount,
              interest_earned::float AS interest_earned, loan_status, payment_status, issue_date, due_date
       FROM loans WHERE customer_id = $1 ORDER BY issue_date DESC`,
      [id]
    );
    const txns = await q(
      `SELECT transaction_id, transaction_date, payment_method, transaction_type, amount::float AS amount, merchant, status
       FROM transactions WHERE customer_id = $1 ORDER BY transaction_date DESC LIMIT 50`,
      [id]
    );
    const payments = await q(
      `SELECT payment_id, loan_id, payment_date, emi_amount::float AS emi_amount, principal_paid::float AS principal_paid,
              interest_paid::float AS interest_paid, payment_status FROM loan_payments WHERE customer_id = $1 ORDER BY payment_date DESC LIMIT 20`,
      [id]
    );

    const stats = {
      totalDeposits: num(accounts.reduce((s, a) => s + num(a.current_balance), 0)),
      totalLoans: num(loans.reduce((s, l) => s + num(l.loan_amount), 0)),
      outstandingLoans: num(loans.reduce((s, l) => s + num(l.outstanding_amount), 0)),
      totalInterestPaid: num(payments.reduce((s, p) => s + num(p.interest_paid), 0)),
      totalTransactionVolume: num(txns.reduce((s, t) => s + num(t.amount), 0)),
    };

    res.json({ customer, accounts, loans, transactions: txns, payments, stats });
  } catch (e) { next(e); }
});

export default router;
