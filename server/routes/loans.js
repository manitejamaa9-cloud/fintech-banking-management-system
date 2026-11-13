import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num } from '../utils/format.js';

const router = Router();
router.use(auth);

const LOAN_STATUSES = ['Active', 'Completed', 'Overdue', 'Defaulted', 'Pending'];

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    const bid = scopedBranchId(user);
    const page = clampInt(req.query.page, 1, 1, 100000);
    const pageSize = clampInt(req.query.pageSize, 20, 1, 200);
    const { type, status, branch, search, minRate, maxRate, from, to, sort } = req.query;

    const params = [];
    const where = ['1=1'];
    if (bid != null) { params.push(Number(bid)); where.push(`l.branch_id = $${params.length}`); }
    if (type) { params.push(type); where.push(`l.loan_type = $${params.length}`); }
    if (status) { params.push(status); where.push(`l.loan_status = $${params.length}`); }
    if (branch) { params.push(Number(branch)); where.push(`l.branch_id = $${params.length}`); }
    if (minRate) { params.push(Number(minRate)); where.push(`l.interest_rate >= $${params.length}`); }
    if (maxRate) { params.push(Number(maxRate)); where.push(`l.interest_rate <= $${params.length}`); }
    if (from) { params.push(from); where.push(`l.issue_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`l.issue_date <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(l.loan_id::text ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    const whereSql = where.join(' AND ');
    const orderBy = {
      id_desc: 'l.loan_id DESC',
      amount_desc: 'l.loan_amount DESC',
      outstanding_desc: 'l.outstanding_amount DESC',
      issue_desc: 'l.issue_date DESC',
    }[sort] || 'l.loan_id DESC';

    const countRows = await q(
      `SELECT COUNT(*)::int c FROM loans l JOIN customers c ON c.customer_id = l.customer_id WHERE ${whereSql}`,
      params
    );
    const total = num(countRows[0]?.c);
    const offset = (page - 1) * pageSize;
    const listParams = [...params, pageSize, offset];

    const loans = await q(
      `SELECT l.loan_id, l.customer_id, c.name AS customer_name, l.branch_id, b.branch_name,
              l.loan_type, l.loan_amount::float AS loan_amount, l.interest_rate::float AS interest_rate,
              l.tenure_months, l.emi::float AS emi, l.amount_repaid::float AS amount_repaid,
              l.outstanding_amount::float AS outstanding_amount, l.interest_earned::float AS interest_earned,
              l.interest_received::float AS interest_received,
              l.loan_status, l.payment_status, l.issue_date, l.due_date
       FROM loans l
       JOIN customers c ON c.customer_id = l.customer_id
       JOIN branches b ON b.branch_id = l.branch_id
       WHERE ${whereSql} ORDER BY ${orderBy} LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    const types = await q('SELECT DISTINCT loan_type FROM loans ORDER BY loan_type');
    res.json({
      loans,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      filters: { types: types.map((t) => t.loan_type), statuses: LOAN_STATUSES },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = req.user;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid loan id' });
    const bid = scopedBranchId(user);
    const params = [id];
    let sc = '';
    if (bid != null) { params.push(Number(bid)); sc = ` AND l.branch_id = $2`; }
    const loans = await q(
      `SELECT l.*, c.name AS customer_name, c.credit_score, c.occupation, c.monthly_income::float AS monthly_income,
              b.branch_name
       FROM loans l
       JOIN customers c ON c.customer_id = l.customer_id
       JOIN branches b ON b.branch_id = l.branch_id
       WHERE l.loan_id = $1${sc}`,
      params
    );
    if (!loans.length) return res.status(404).json({ error: 'Loan not found' });

    const payments = await q(
      `SELECT lp.payment_id, lp.payment_date, lp.emi_amount::float AS emi_amount, lp.principal_paid::float AS principal_paid,
              lp.interest_paid::float AS interest_paid, lp.payment_method, lp.payment_status
       FROM loan_payments lp WHERE lp.loan_id = $1 ORDER BY lp.payment_date`,
      [id]
    );

    const loan = loans[0];
    const numericFields = [
      'loan_amount', 'interest_rate', 'tenure_months', 'emi', 'amount_repaid',
      'outstanding_amount', 'interest_earned', 'interest_received', 'monthly_income', 'credit_score',
    ];
    numericFields.forEach((k) => {
      if (loan[k] != null) loan[k] = Number(loan[k]);
    });
    res.json({ loan, payments });
  } catch (e) {
    next(e);
  }
});

export default router;
