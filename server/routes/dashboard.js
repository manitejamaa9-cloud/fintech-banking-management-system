import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num, round2, fmtDate, todayStr } from '../utils/format.js';
import { resolvePeriod, suggestBucket, PERIOD_DAYS, PERIOD_LABELS } from '../utils/dates.js';
import { growthPercent, profitMargin, emiCollectionRate } from '../utils/finance.js';
import {
  fetchRevenue,
  fetchExpenses,
  fetchTransactions,
  fetchLoanPayments,
  sumField,
  groupByBucket,
  bucketSeries,
} from '../utils/queries.js';

const router = Router();
router.use(auth);

// Kept for backwards compatibility with older frontends.
export const RANGES = { ...PERIOD_DAYS };

const REVENUE_BUCKETS = {
  'Loan Interest': 'Loan Interest',
  'Transaction Fees': 'Transaction Revenue',
  'Processing Fees': 'Banking Fees',
  'Card Fees': 'Banking Fees',
  'ATM Fees': 'Banking Fees',
  'Maintenance Charges': 'Banking Fees',
  'Penalties & Late Charges': 'Banking Fees',
  'Investment Income': 'Other Income',
  'Other Income': 'Other Income',
};

const EXPENSE_BUCKETS = {
  'Employee Salaries': 'Employee Costs',
  'Interest Paid (Depositors)': 'Interest Paid',
  'ATM Maintenance': 'Maintenance',
  Technology: 'Operating Expenses',
  Rent: 'Operating Expenses',
  'Electricity & Utilities': 'Operating Expenses',
  Marketing: 'Operating Expenses',
  Administrative: 'Operating Expenses',
  'Other Operating': 'Other Expenses',
};

function summarize(rows, bucketMap) {
  const map = {};
  for (const r of rows) {
    const type = r.revenue_type || r.expense_type || 'Other';
    const key = bucketMap[type] || type;
    map[key] = round2((map[key] || 0) + num(r.amount));
  }
  return map;
}

function branchScope(user) {
  const bid = scopedBranchId(user);
  return {
    bid,
    sql: bid != null ? ' AND branch_id = $1' : '',
    params: bid != null ? [Number(bid)] : [],
  };
}

async function activeCustomers(user, from) {
  const bid = scopedBranchId(user);
  const params = [];
  const where = ["status = 'Successful'"];
  if (bid != null) {
    params.push(Number(bid));
    where.push(`branch_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`transaction_date >= $${params.length}`);
  }
  const rows = await q(`SELECT DISTINCT customer_id FROM transactions WHERE ${where.join(' AND ')}`, params);
  return rows.length;
}

async function emiCollection(user, from, to) {
  const bid = scopedBranchId(user);
  const params = [];
  let where = "payment_status = 'paid'";
  if (bid != null) {
    params.push(Number(bid));
    where += ` AND branch_id = $${params.length}`;
  }
  if (from) {
    params.push(from);
    where += ` AND payment_date >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    where += ` AND payment_date <= $${params.length}`;
  }
  const paidRows = await q(`SELECT COALESCE(SUM(emi_amount),0)::float AS v, COUNT(*)::int AS n FROM loan_payments WHERE ${where}`, params);

  const lparams = [];
  let lwhere = "loan_status IN ('Active','Overdue')";
  if (bid != null) {
    lparams.push(Number(bid));
    lwhere += ` AND branch_id = $${lparams.length}`;
  }
  const dueRows = await q(`SELECT COALESCE(SUM(emi),0)::float AS v, COUNT(*)::int AS n FROM loans WHERE ${lwhere}`, lparams);
  const collected = num(paidRows[0]?.v);
  const due = num(dueRows[0]?.v);

  // Operational collection rate for the current calendar month, independent of
  // the reporting period (it is labelled as "this month" in the UI).
  const monthStart = `${todayStr().slice(0, 8)}01`;
  const mp = bid != null ? [monthStart, Number(bid)] : [monthStart];
  // Only count payments against loans that are still active/overdue so the
  // numerator and denominator describe the same book. Completed loans can have
  // a final EMI in the current month, and mixing those in produced rates >100%.
  const monthPaid = await q(
    `SELECT COALESCE(SUM(lp.emi_amount),0)::float AS v, COUNT(*)::int AS n
     FROM loan_payments lp
     JOIN loans l ON l.loan_id = lp.loan_id
     WHERE lp.payment_status = 'paid' AND lp.payment_date >= $1
       AND l.loan_status IN ('Active','Overdue')${bid != null ? ' AND lp.branch_id = $2' : ''}`,
    mp
  );
  const currentMonthCollected = num(monthPaid[0]?.v);

  return {
    collected: round2(collected),
    payments: num(paidRows[0]?.n),
    monthlyDue: round2(due),
    activeLoans: num(dueRows[0]?.n),
    currentMonth: {
      collected: round2(currentMonthCollected),
      payments: num(monthPaid[0]?.n),
      rate: emiCollectionRate(currentMonthCollected, due),
    },
    rate: emiCollectionRate(currentMonthCollected, due),
  };
}

// ---------- Main overview ----------
router.get('/overview', async (req, res, next) => {
  try {
    const user = req.user;
    const period = resolvePeriod({ period: req.query.period, from: req.query.from, to: req.query.to });
    const { from, to, previous } = period;
    const sc = branchScope(user);
    const bucket = suggestBucket(period.days);

    const custRows = await q(`SELECT customer_id, branch_id, status, created_at FROM customers WHERE 1=1${sc.sql}`, sc.params);
    const newCustomers = from ? custRows.filter((c) => fmtDate(c.created_at) >= from && fmtDate(c.created_at) <= to).length : custRows.length;

    const depRows = await q(`SELECT current_balance::float AS b FROM accounts WHERE status='active'${sc.sql}`, sc.params);
    const deposits = round2(sumField(depRows, 'b'));

    const loanRows = await q(
      `SELECT loan_id, branch_id, loan_amount::float AS amount, outstanding_amount::float AS o,
              interest_earned::float AS interest_earned, issue_date, loan_status
       FROM loans WHERE 1=1${sc.sql}`,
      sc.params
    );
    const loansInPeriod = from ? loanRows.filter((l) => fmtDate(l.issue_date) >= from && fmtDate(l.issue_date) <= to) : loanRows;

    const paymentsPeriod = await fetchLoanPayments(user, from, to);
    const paidPeriod = paymentsPeriod.filter((p) => p.payment_status === 'paid');
    const loanInterestIncome = round2(sumField(paidPeriod, 'interest_paid'));

    const txnRows = await fetchTransactions(user, from, to);
    const txnSuccessfulRows = txnRows.filter((t) => t.status === 'Successful');
    const txnVolume = round2(sumField(txnSuccessfulRows, 'amount'));

    const rev = await fetchRevenue(user, from, to);
    const exp = await fetchExpenses(user, from, to);
    const revenue = round2(sumField(rev, 'amount'));
    const expenses = round2(sumField(exp, 'amount'));
    const net = round2(revenue - expenses);

    let prevRevenue = null;
    let prevExpenses = null;
    let prevNetProfit = null;
    if (previous) {
      prevRevenue = round2(sumField(await fetchRevenue(user, previous.from, previous.to), 'amount'));
      prevExpenses = round2(sumField(await fetchExpenses(user, previous.from, previous.to), 'amount'));
      prevNetProfit = round2(prevRevenue - prevExpenses);
    }

    const trendRev = groupByBucket(rev, bucket);
    const trendExp = groupByBucket(exp, bucket);
    const monthlyTrend =
      from != null
        ? bucketSeries(from, to, bucket).map((label) => {
            const r = round2(sumField(trendRev.get(label) || [], 'amount'));
            const e = round2(sumField(trendExp.get(label) || [], 'amount'));
            return { label, revenue: r, expenses: e, profit: round2(r - e) };
          })
        : [];

    const branchList = await q(
      `SELECT branch_id, branch_name, city FROM branches WHERE 1=1${sc.sql} ORDER BY branch_id`,
      sc.params
    );
    const branchPerformance = branchList.map((b) => {
      const r = round2(sumField(rev.filter((x) => x.branch_id === b.branch_id), 'amount'));
      const e = round2(sumField(exp.filter((x) => x.branch_id === b.branch_id), 'amount'));
      const loans = loanRows.filter((l) => l.branch_id === b.branch_id);
      return {
        branch_id: b.branch_id,
        branch_name: b.branch_name,
        city: b.city,
        revenue: r,
        expenses: e,
        profit: round2(r - e),
        margin: profitMargin(r, e),
        loans: loans.length,
        outstanding: round2(sumField(loans, 'o')),
      };
    });

    const emi = await emiCollection(user, from, to);

    res.json({
      period: period.key,
      periodLabel: period.label,
      days: period.days,
      from,
      to,
      bucket,
      customers: {
        total: custRows.length,
        active: await activeCustomers(user, from),
        new: newCustomers,
      },
      deposits,
      loans: {
        total: loanRows.length,
        amount: round2(sumField(loanRows, 'amount')),
        issued: loansInPeriod.length,
        issuedAmount: round2(sumField(loansInPeriod, 'amount')),
        outstanding: round2(sumField(loanRows, 'o')),
      },
      interestEarned: { period: loanInterestIncome },
      loanInterestIncome,
      transactions: {
        count: txnRows.length,
        successful: txnSuccessfulRows.length,
        failed: txnRows.filter((t) => t.status === 'Failed').length,
        pending: txnRows.filter((t) => t.status === 'Pending').length,
        volume: txnVolume,
      },
      emi,
      revenue,
      expenses,
      netProfit: net,
      isProfit: net >= 0,
      profitPercent: profitMargin(revenue, expenses),
      prevRevenue,
      prevExpenses,
      prevNetProfit,
      revenueGrowth: growthPercent(revenue, prevRevenue),
      expenseGrowth: growthPercent(expenses, prevExpenses),
      profitGrowth: growthPercent(net, prevNetProfit),
      revenueBreakdown: summarize(rev, REVENUE_BUCKETS),
      expenseBreakdown: summarize(exp, EXPENSE_BUCKETS),
      monthlyTrend,
      branchPerformance,
      currency: 'INR',
      dataNote: 'Figures are calculated from the local demonstration database, not a production banking ledger.',
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Profit performance by time range ----------
router.get('/profit-performance', async (req, res, next) => {
  try {
    const user = req.user;
    const period = resolvePeriod({ period: req.query.range || req.query.period, from: req.query.from, to: req.query.to });
    const { from, to, previous } = period;
    const bucket = suggestBucket(period.days);

    const rev = await fetchRevenue(user, from, to);
    const exp = await fetchExpenses(user, from, to);
    const revenue = round2(sumField(rev, 'amount'));
    const expenses = round2(sumField(exp, 'amount'));
    const net = round2(revenue - expenses);

    let prevRevenue = null;
    let prevExpenses = null;
    let prevNetProfit = null;
    if (previous) {
      prevRevenue = round2(sumField(await fetchRevenue(user, previous.from, previous.to), 'amount'));
      prevExpenses = round2(sumField(await fetchExpenses(user, previous.from, previous.to), 'amount'));
      prevNetProfit = round2(prevRevenue - prevExpenses);
    }

    const breakdown = summarize(rev, REVENUE_BUCKETS);
    const loanInterest = round2(
      sumField((await fetchLoanPayments(user, from, to)).filter((p) => p.payment_status === 'paid'), 'interest_paid')
    );

    const revByBucket = groupByBucket(rev, bucket);
    const expByBucket = groupByBucket(exp, bucket);
    const series = bucketSeries(from, to, bucket).map((label) => {
      const r = round2(sumField(revByBucket.get(label) || [], 'amount'));
      const e = round2(sumField(expByBucket.get(label) || [], 'amount'));
      return { label, revenue: r, expenses: e, profit: round2(r - e) };
    });

    res.json({
      range: period.key,
      periodLabel: period.label,
      days: period.days,
      from,
      to,
      bucket,
      revenue,
      expenses,
      netProfit: net,
      isProfit: net >= 0,
      profitPercent: profitMargin(revenue, expenses),
      growth: growthPercent(net, prevNetProfit),
      revenueGrowth: growthPercent(revenue, prevRevenue),
      expenseGrowth: growthPercent(expenses, prevExpenses),
      prevRevenue,
      prevExpenses,
      prevNetProfit,
      loanInterest,
      transactionRevenue: num(breakdown['Transaction Revenue']),
      bankingFees: round2(num(breakdown['Banking Fees']) + num(breakdown['ATM Fees'] || 0)),
      otherRevenue: round2(num(breakdown['Other Income']) + num(breakdown['Investment Income'] || 0)),
      series,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/periods', (req, res) => {
  res.json({
    periods: Object.entries(PERIOD_LABELS).map(([key, label]) => ({ key, label, days: PERIOD_DAYS[key] ?? null })),
  });
});

export default router;
