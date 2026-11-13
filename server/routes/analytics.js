import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num, round2, todayStr, daysAgoStr, fmtDate } from '../utils/format.js';
import { parseIsoDate } from '../utils/dates.js';
import { buildForecast } from '../utils/forecast.js';
import {
  fetchRevenue, fetchExpenses, fetchTransactions, fetchLoanPayments,
  sumField, groupByBucket, bucketSeries,
} from '../utils/queries.js';

const router = Router();
router.use(auth);

const BUCKET_OPTIONS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

function bucketOrDefault(qp, fallback) {
  const b = qp.bucket || fallback;
  return BUCKET_OPTIONS.includes(b) ? b : fallback;
}

function defaultRange(req, months = 24) {
  const to = parseIsoDate(req.query.to) || todayStr();
  const from = parseIsoDate(req.query.from) || daysAgoStr(Math.round(months * 30.44));
  return from <= to ? { from, to } : { from: to, to: from };
}

// ---------- P&L over time ----------
router.get('/pnl', async (req, res, next) => {
  try {
    const user = req.user;
    const bucket = bucketOrDefault(req.query, 'monthly');
    const { from, to } = defaultRange(req, 24);
    const rev = await fetchRevenue(user, from, to);
    const exp = await fetchExpenses(user, from, to);
    const revMap = groupByBucket(rev, bucket);
    const expMap = groupByBucket(exp, bucket);
    const series = bucketSeries(from, to, bucket).map((label) => ({
      label,
      revenue: round2(sumField(revMap.get(label) || [], 'amount')),
      expenses: round2(sumField(expMap.get(label) || [], 'amount')),
    }));
    series.forEach((s) => (s.profit = round2(s.revenue - s.expenses)));
    const totalRevenue = round2(sumField(rev, 'amount'));
    const totalExpenses = round2(sumField(exp, 'amount'));
    res.json({ series, totalRevenue, totalExpenses, netProfit: round2(totalRevenue - totalExpenses), bucket, from, to });
  } catch (e) { next(e); }
});

// ---------- Revenue breakdown ----------
router.get('/revenue-breakdown', async (req, res, next) => {
  try {
    const user = req.user;
    const bucket = bucketOrDefault(req.query, 'monthly');
    const { from, to } = defaultRange(req, 24);
    const rev = await fetchRevenue(user, from, to);
    const revMap = groupByBucket(rev, bucket);
    const keys = ['Loan Interest', 'Transaction Fees', 'Card Fees', 'ATM Fees', 'Processing Fees', 'Maintenance Charges', 'Penalties & Late Charges', 'Investment Income', 'Other Income'];
    const short = {
      'Loan Interest': 'loanInterest',
      'Transaction Fees': 'transactionFees',
      'Card Fees': 'cardFees',
      'ATM Fees': 'atmFees',
      'Processing Fees': 'processingFees',
      'Maintenance Charges': 'maintenanceCharges',
      'Penalties & Late Charges': 'penalties',
      'Investment Income': 'investmentIncome',
      'Other Income': 'otherIncome',
    };
    const series = bucketSeries(from, to, bucket).map((label) => {
      const point = { label };
      keys.forEach((k) => (point[short[k]] = round2(sumField((revMap.get(label) || []).filter((r) => r.revenue_type === k), 'amount'))));
      return point;
    });
    const totals = keys.map((k) => ({
      name: k,
      value: round2(sumField(rev.filter((r) => r.revenue_type === k), 'amount')),
    }));
    res.json({ series, totals, bucket, from, to });
  } catch (e) { next(e); }
});

// ---------- Expense breakdown ----------
router.get('/expense-breakdown', async (req, res, next) => {
  try {
    const user = req.user;
    const bucket = bucketOrDefault(req.query, 'monthly');
    const { from, to } = defaultRange(req, 24);
    const exp = await fetchExpenses(user, from, to);
    const expMap = groupByBucket(exp, bucket);
    const keys = ['Employee Salaries', 'Rent', 'Technology', 'Electricity & Utilities', 'ATM Maintenance', 'Marketing', 'Administrative', 'Interest Paid (Depositors)', 'Other Operating'];
    const short = {
      'Employee Salaries': 'salaries',
      'Rent': 'rent',
      'Technology': 'technology',
      'Electricity & Utilities': 'utilities',
      'ATM Maintenance': 'atmMaintenance',
      'Marketing': 'marketing',
      'Administrative': 'administrative',
      'Interest Paid (Depositors)': 'interestPaid',
      'Other Operating': 'other',
    };
    const series = bucketSeries(from, to, bucket).map((label) => {
      const point = { label };
      keys.forEach((k) => (point[short[k]] = round2(sumField((expMap.get(label) || []).filter((r) => r.expense_type === k), 'amount'))));
      return point;
    });
    const totals = keys.map((k) => ({
      name: k,
      value: round2(sumField(exp.filter((r) => r.expense_type === k), 'amount')),
    }));
    res.json({ series, totals, bucket, from, to });
  } catch (e) { next(e); }
});

// ---------- Loan analytics ----------
router.get('/loans', async (req, res, next) => {
  try {
    const user = req.user;
    const bid = scopedBranchId(user);
    const sc = bid != null ? ` WHERE branch_id = $1` : '';
    const scParams = bid != null ? [Number(bid)] : [];

    const loans = await q(`SELECT loan_id, loan_type, loan_status, loan_amount::float AS amount, outstanding_amount::float AS outstanding, interest_earned::float AS interest_earned, branch_id FROM loans${sc}`, scParams);
    const statuses = ['Active', 'Completed', 'Overdue', 'Defaulted', 'Pending'];
    const statusStats = statuses.map((s) => ({
      name: s,
      count: loans.filter((l) => l.loan_status === s).length,
      amount: round2(sumField(loans.filter((l) => l.loan_status === s), 'amount')),
    }));

    // monthly interest trend (last 12 months)
    const trendFrom = daysAgoStr(365);
    const payments = await fetchLoanPayments(user, trendFrom, todayStr());
    const paid = payments.filter((p) => p.payment_status === 'paid');
    const interestMap = groupByBucket(paid, 'monthly', 'payment_date');
    const interestTrend = bucketSeries(trendFrom, todayStr(), 'monthly').map((label) => ({
      label,
      interest: round2(sumField(interestMap.get(label) || [], 'interest_paid')),
    }));

    res.json({
      statuses: statusStats,
      totals: {
        total: loans.length,
        active: statusStats[0].count,
        completed: statusStats[1].count,
        overdue: statusStats[2].count,
        defaulted: statusStats[3].count,
        pending: statusStats[4].count,
        defaultRate: loans.length ? round2((statusStats[3].count / loans.length) * 100) : 0,
        issuedAmount: round2(sumField(loans, 'amount')),
        outstanding: round2(sumField(loans, 'outstanding')),
        interestEarned: round2(sumField(loans, 'interest_earned')),
      },
      interestTrend,
    });
  } catch (e) { next(e); }
});

// ---------- Payment method analytics ----------
router.get('/payment-methods', async (req, res, next) => {
  try {
    const user = req.user;
    const { from, to } = defaultRange(req, 12);
    const txn = await fetchTransactions(user, from, to);
    const methods = [...new Set(txn.map((t) => t.payment_method))];
    const data = methods.map((m) => {
      const rows = txn.filter((t) => t.payment_method === m);
      return {
        method: m,
        count: rows.length,
        successful: rows.filter((t) => t.status === 'Successful').length,
        failed: rows.filter((t) => t.status === 'Failed').length,
        value: round2(sumField(rows.filter((t) => t.status === 'Successful'), 'amount')),
      };
    }).sort((a, b) => b.value - a.value);
    res.json({ methods: data, from, to, totalCount: txn.length, totalValue: round2(sumField(data, 'value')) });
  } catch (e) { next(e); }
});

// ---------- Customer analytics ----------
router.get('/customers', async (req, res, next) => {
  try {
    const user = req.user;
    const bid = scopedBranchId(user);
    const sc = bid != null ? ` WHERE branch_id = $1` : '';
    const scParams = bid != null ? [Number(bid)] : [];
    const customers = await q(`SELECT customer_id, branch_id, city, status, created_at FROM customers${sc}`, scParams);
    const accounts = await q(`SELECT account_id, customer_id, current_balance::float AS bal FROM accounts${sc ? sc.replace('branch_id', 'branch_id') : ''}`, scParams);
    const txn = await fetchTransactions(user, daysAgoStr(90));

    const activeSet = new Set(txn.filter((t) => t.status === 'Successful').map((t) => t.customer_id));
    const newCutoff = daysAgoStr(30);
    const newCustomers = customers.filter((c) => fmtDate(c.created_at) >= newCutoff).length;
    const active = customers.filter((c) => activeSet.has(c.customer_id)).length;
    const inactive = customers.length - active;
    const balanceByCust = {};
    accounts.forEach((a) => (balanceByCust[a.customer_id] = (balanceByCust[a.customer_id] || 0) + num(a.bal)));
    const highValue = Object.values(balanceByCust).filter((b) => b >= 1000000).length;
    const avgBalance = accounts.length ? round2(sumField(accounts, 'bal') / accounts.length) : 0;

    const cityDist = {};
    customers.forEach((c) => (cityDist[c.city] = (cityDist[c.city] || 0) + 1));
    const byBranch = {};
    customers.forEach((c) => (byBranch[`${c.branch_id}`] = (byBranch[`${c.branch_id}`] || 0) + 1));

    res.json({
      total: customers.length,
      newCustomers,
      active,
      inactive,
      highValue,
      avgBalance,
      inactiveRate: customers.length ? round2((inactive / customers.length) * 100) : 0,
      cityDistribution: Object.entries(cityDist).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count),
      branchDistribution: byBranch,
    });
  } catch (e) { next(e); }
});

// ---------- Loan type analytics ----------
router.get('/loan-types', async (req, res, next) => {
  try {
    const user = req.user;
    const bid = scopedBranchId(user);
    const sc = bid != null ? ` WHERE branch_id = $1` : '';
    const scParams = bid != null ? [Number(bid)] : [];
    const loans = await q(`SELECT loan_type, loan_status, loan_amount::float AS amount, outstanding_amount::float AS outstanding, interest_earned::float AS interest_earned FROM loans${sc}`, scParams);
    const types = [...new Set(loans.map((l) => l.loan_type))];
    const data = types.map((t) => {
      const rows = loans.filter((l) => l.loan_type === t);
      const def = rows.filter((l) => l.loan_status === 'Defaulted');
      return {
        type: t,
        loans: rows.length,
        amount: round2(sumField(rows, 'amount')),
        interestEarned: round2(sumField(rows, 'interest_earned')),
        outstanding: round2(sumField(rows, 'outstanding')),
        defaulted: def.length,
        defaultRate: rows.length ? round2((def.length / rows.length) * 100) : 0,
      };
    }).sort((a, b) => b.amount - a.amount);
    res.json({ types: data });
  } catch (e) { next(e); }
});

// ---------- Profit forecast ----------
router.get('/forecast', async (req, res, next) => {
  try {
    const user = req.user;
    const to = todayStr();
    const from = daysAgoStr(365); // up to 12 months of history
    const rev = await fetchRevenue(user, from, to);
    const exp = await fetchExpenses(user, from, to);
    const revMap = groupByBucket(rev, 'monthly');
    const expMap = groupByBucket(exp, 'monthly');
    const labels = bucketSeries(from, to, 'monthly');

    const months = labels.map((label) => {
      const rRows = revMap.get(label) || [];
      const eRows = expMap.get(label) || [];
      return {
        label,
        profit: round2(sumField(rRows, 'amount') - sumField(eRows, 'amount')),
        hasData: rRows.length > 0 || eRows.length > 0,
      };
    });

    const forecast = buildForecast(months, { horizonMonths: 12, minPoints: 3 });
    const observedProfit = round2(
      months.filter((m) => m.hasData).reduce((s, m) => s + m.profit, 0)
    );
    const observedCount = months.filter((m) => m.hasData).length;

    res.json({
      ...forecast,
      currentProfit: observedProfit,
      currentAvgMonthly: observedCount ? round2(observedProfit / observedCount) : null,
      note: 'Forecasts are estimates based only on historical revenue and expense records in this database.',
    });
  } catch (e) { next(e); }
});

export default router;
