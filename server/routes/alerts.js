import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num, round2, todayStr, daysAgoStr, fmtDate } from '../utils/format.js';
import { fetchRevenue, fetchExpenses, fetchTransactions, fetchLoanPayments, sumField } from '../utils/queries.js';
import { growthPercent } from '../utils/finance.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    const bid = scopedBranchId(user);
    const sc = bid != null ? ` WHERE branch_id = $1` : '';
    const scParams = bid != null ? [Number(bid)] : [];
    const alerts = [];
    let id = 1;

    const to = todayStr();
    const curFrom = daysAgoStr(30);
    const prevFrom = daysAgoStr(60);
    const prevTo = daysAgoStr(30);

    const loans = await q(`SELECT loan_status FROM loans${sc}`, scParams);
    const defRate = loans.length ? (loans.filter((l) => l.loan_status === 'Defaulted').length / loans.length) * 100 : 0;
    if (defRate > 5) {
      alerts.push({ id: id++, severity: 'critical', title: 'High loan default rate', message: `Defaulted loans are at ${defRate.toFixed(1)}% of the total portfolio — above the 5% risk threshold.`, metric: 'Loan Defaults', value: defRate.toFixed(1) + '%' });
    }

    const curTxn = await fetchTransactions(user, curFrom, to);
    const prevTxn = await fetchTransactions(user, prevFrom, prevTo);
    const curVol = sumField(curTxn.filter((t) => t.status === 'Successful'), 'amount');
    const prevVol = sumField(prevTxn.filter((t) => t.status === 'Successful'), 'amount');
    const volChg = growthPercent(curVol, prevVol);
    if (volChg != null && volChg < -10) {
      alerts.push({ id: id++, severity: 'warning', title: 'Transaction volume decreasing', message: `Successful transaction volume is down ${Math.abs(volChg).toFixed(1)}% vs the previous 30 days.`, metric: 'Transaction Volume', value: volChg.toFixed(1) + '%' });
    }

    const curRev = await fetchRevenue(user, curFrom, to);
    const curExp = await fetchExpenses(user, curFrom, to);
    const revenue = sumField(curRev, 'amount');
    const expenses = sumField(curExp, 'amount');
    const profit = revenue - expenses;
    const prevRev = await fetchRevenue(user, prevFrom, prevTo);
    const prevExp = await fetchExpenses(user, prevFrom, prevTo);
    const prevProfit = sumField(prevRev, 'amount') - sumField(prevExp, 'amount');
    const profitChg = growthPercent(profit, prevProfit);
    if (profitChg != null && profitChg > 5) {
      alerts.push({ id: id++, severity: 'success', title: 'Profit increased', message: `Net profit rose ${profitChg.toFixed(1)}% compared with the previous 30 days.`, metric: 'Net Profit', value: '+' + profitChg.toFixed(1) + '%' });
    } else if (profitChg != null && profitChg < -10) {
      alerts.push({ id: id++, severity: 'critical', title: 'Profit falling', message: `Net profit dropped ${Math.abs(profitChg).toFixed(1)}% vs the previous 30 days.`, metric: 'Net Profit', value: profitChg.toFixed(1) + '%' });
    }

    const expChg = growthPercent(expenses, sumField(prevExp, 'amount'));
    if (expChg != null && expChg > 12) {
      alerts.push({ id: id++, severity: 'critical', title: 'Expenses increased', message: `Total expenses are up ${expChg.toFixed(1)}% vs the previous 30 days.`, metric: 'Expenses', value: '+' + expChg.toFixed(1) + '%' });
    } else if (expChg != null && expChg > 5) {
      alerts.push({ id: id++, severity: 'warning', title: 'Expenses rising', message: `Total expenses increased ${expChg.toFixed(1)}% vs the previous 30 days.`, metric: 'Expenses', value: '+' + expChg.toFixed(1) + '%' });
    }

    const upiCur = curTxn.filter((t) => t.payment_method === 'UPI');
    const upiFailed = upiCur.filter((t) => t.status === 'Failed').length;
    if (upiCur.length && upiFailed / upiCur.length > 0.08) {
      alerts.push({ id: id++, severity: 'warning', title: 'Failed UPI transactions', message: `${upiFailed} of ${upiCur.length} UPI transactions (${((upiFailed / upiCur.length) * 100).toFixed(1)}%) failed in the last 30 days.`, metric: 'UPI Success', value: upiFailed + ' failed' });
    }

    const outRows = await q(`SELECT outstanding_amount::float AS o, issue_date FROM loans${sc}`, scParams);
    const curOut = sumField(outRows.filter((l) => fmtDate(l.issue_date) >= curFrom), 'o');
    const prevOut = sumField(outRows.filter((l) => fmtDate(l.issue_date) >= prevFrom && fmtDate(l.issue_date) < prevTo), 'o');
    if (curOut > prevOut * 1.2 && prevOut > 0) {
      alerts.push({ id: id++, severity: 'warning', title: 'Outstanding loan amount increasing', message: `New loan disbursements pushed outstanding balances up ${((curOut / prevOut - 1) * 100).toFixed(1)}%.`, metric: 'Outstanding Loans', value: '+' + ((curOut / prevOut - 1) * 100).toFixed(1) + '%' });
    }

    const intCur = sumField((await fetchLoanPayments(user, curFrom, to)).filter((p) => p.payment_status === 'paid'), 'interest_paid');
    const intPrev = sumField((await fetchLoanPayments(user, prevFrom, prevTo)).filter((p) => p.payment_status === 'paid'), 'interest_paid');
    if (intCur > intPrev * 1.05) {
      alerts.push({ id: id++, severity: 'success', title: 'Interest income increased', message: `Interest earned from loans grew ${intPrev ? ((intCur / intPrev - 1) * 100).toFixed(1) : 0}% vs the previous 30 days.`, metric: 'Interest Income', value: '+' + (intPrev ? ((intCur / intPrev - 1) * 100).toFixed(1) : 0) + '%' });
    }

    const custNew = await q(`SELECT COUNT(*) c FROM customers WHERE created_at >= $1${bid != null ? ` AND branch_id = $${2}` : ''}`, bid != null ? [curFrom, Number(bid)] : [curFrom]);
    const newCount = num(custNew[0].c);
    if (newCount > 0) {
      alerts.push({ id: id++, severity: 'success', title: 'New customers onboarded', message: `${newCount} new customer(s) opened accounts in the last 30 days.`, metric: 'Customers', value: '+' + newCount });
    }

    res.json({ alerts });
  } catch (e) { next(e); }
});

export default router;
