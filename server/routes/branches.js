import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num, round2 } from '../utils/format.js';
import { resolvePeriod } from '../utils/dates.js';
import { profitMargin } from '../utils/finance.js';
import { sumField, groupByBucket, bucketSeries } from '../utils/queries.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const bid = scopedBranchId(req.user);
    const rows = await q(
      `SELECT branch_id, branch_code, branch_name, city, address, phone FROM branches
       WHERE 1=1${bid != null ? ' AND branch_id = $1' : ''} ORDER BY branch_id`,
      bid != null ? [Number(bid)] : []
    );
    res.json({ branches: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const user = req.user;
    const bid = scopedBranchId(user);
    const period = resolvePeriod({ period: req.query.period, from: req.query.from, to: req.query.to });
    const { from, to } = period;
    const scope = bid != null ? ' AND branch_id = $3' : '';
    const baseParams = bid != null ? [from, to, Number(bid)] : [from, to];

    const branches = await q(
      `SELECT branch_id, branch_name, city, branch_code FROM branches
       WHERE 1=1${bid != null ? ' AND branch_id = $1' : ''} ORDER BY branch_id`,
      bid != null ? [Number(bid)] : []
    );

    const rev = await q(`SELECT branch_id, amount::float AS amount, date FROM revenue WHERE date >= $1 AND date <= $2${scope}`, baseParams);
    const exp = await q(`SELECT branch_id, amount::float AS amount, date FROM expenses WHERE date >= $1 AND date <= $2${scope}`, baseParams);
    const loans = await q(
      `SELECT branch_id, loan_status, loan_amount::float AS amount, outstanding_amount::float AS o FROM loans WHERE 1=1${bid != null ? ' AND branch_id = $1' : ''}`,
      bid != null ? [Number(bid)] : []
    );
    const accounts = await q(
      `SELECT branch_id, current_balance::float AS bal FROM accounts WHERE status='active'${bid != null ? ' AND branch_id = $1' : ''}`,
      bid != null ? [Number(bid)] : []
    );
    const txns = await q(
      `SELECT branch_id, amount::float AS amount, status FROM transactions WHERE transaction_date >= $1 AND transaction_date <= $2${scope}`,
      baseParams
    );
    const customers = await q(
      `SELECT branch_id, customer_id FROM customers WHERE 1=1${bid != null ? ' AND branch_id = $1' : ''}`,
      bid != null ? [Number(bid)] : []
    );

    const rows = branches.map((b) => {
      const id = b.branch_id;
      const bRev = sumField(rev.filter((r) => r.branch_id === id), 'amount');
      const bExp = sumField(exp.filter((r) => r.branch_id === id), 'amount');
      const bLoans = loans.filter((l) => l.branch_id === id);
      const bDefaults = bLoans.filter((l) => l.loan_status === 'Defaulted').length;
      const bAccounts = accounts.filter((a) => a.branch_id === id);
      const bTxns = txns.filter((t) => t.branch_id === id && t.status === 'Successful');
      return {
        ...b,
        revenue: round2(bRev),
        expenses: round2(bExp),
        profit: round2(bRev - bExp),
        margin: profitMargin(bRev, bExp),
        loans: bLoans.length,
        loansAmount: round2(sumField(bLoans, 'amount')),
        outstanding: round2(sumField(bLoans, 'o')),
        defaults: bDefaults,
        defaultRate: bLoans.length ? round2((bDefaults / bLoans.length) * 100) : 0,
        deposits: round2(sumField(bAccounts, 'bal')),
        transactions: bTxns.length,
        transactionVolume: round2(sumField(bTxns, 'amount')),
        customers: customers.filter((c) => c.branch_id === id).length,
      };
    });

    const ranking = [...rows].sort((a, b) => b.profit - a.profit);

    const revMap = groupByBucket(rev, 'monthly');
    const expMap = groupByBucket(exp, 'monthly');
    const labels = bucketSeries(from, to, 'monthly');
    const series = labels.map((label) => {
      const point = { label };
      branches.forEach((b) => {
        const r = sumField((revMap.get(label) || []).filter((x) => x.branch_id === b.branch_id), 'amount');
        const e = sumField((expMap.get(label) || []).filter((x) => x.branch_id === b.branch_id), 'amount');
        point[`branch_${b.branch_id}`] = round2(r - e);
      });
      return point;
    });

    res.json({ branches: rows, ranking, series, from, to, period: period.key });
  } catch (e) {
    next(e);
  }
});

export default router;
