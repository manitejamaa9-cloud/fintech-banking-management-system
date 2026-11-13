import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num, round2, todayStr, daysAgoStr, fmtDate } from '../utils/format.js';
import { resolvePeriod, PERIOD_DAYS } from '../utils/dates.js';
import { sumField, groupByBucket, bucketSeries } from '../utils/queries.js';

const router = Router();
router.use(auth);

const TYPE_TITLES = {
  profitloss: 'Profit & Loss Report',
  monthly: 'Monthly Financial Report',
  quarterly: 'Quarterly Financial Report',
  annual: 'Annual Financial Report',
  yearly: 'Annual Financial Report',
  loan: 'Loan Portfolio Report',
  emi: 'EMI Collection Report',
  transaction: 'Transaction Summary Report',
  branch: 'Branch Performance Report',
  schemes: 'Banking Schemes Report',
};

const DEFAULT_PERIOD = {
  monthly: '1m',
  quarterly: '3m',
  annual: '1y',
  yearly: '1y',
  loan: '1y',
  emi: '1y',
  transaction: '1m',
  branch: '1y',
  profitloss: '1y',
  schemes: '1y',
};

function scopeSql(bid, alias, dateColumn, from, to) {
  const pref = alias ? `${alias}.` : '';
  const params = [from, to];
  let sql = `${pref}${dateColumn} >= $1 AND ${pref}${dateColumn} <= $2`;
  if (bid != null) {
    params.push(Number(bid));
    sql += ` AND ${pref}branch_id = $3`;
  }
  return { sql, params };
}

async function buildReportData(user, type, periodInput) {
  const bid = scopedBranchId(user);
  const requested = periodInput || {};
  const resolved = resolvePeriod({
    period: requested.period || DEFAULT_PERIOD[type] || '1y',
    from: requested.from,
    to: requested.to,
  });
  const { from, to } = resolved;

  const revScope = scopeSql(bid, '', 'date', from, to);
  const expScope = scopeSql(bid, '', 'date', from, to);
  const txnScope = scopeSql(bid, 't', 'transaction_date', from, to);
  const loanScope = scopeSql(bid, 'l', 'issue_date', from, to);
  const payScope = scopeSql(bid, 'lp', 'payment_date', from, to);
  const enrScope = scopeSql(bid, 'e', 'start_date', from, to);

  const rev = await q(
    `SELECT revenue_type, SUM(amount::float) AS total FROM revenue WHERE ${revScope.sql} GROUP BY revenue_type ORDER BY total DESC`,
    revScope.params
  );
  const exp = await q(
    `SELECT expense_type, SUM(amount::float) AS total FROM expenses WHERE ${expScope.sql} GROUP BY expense_type ORDER BY total DESC`,
    expScope.params
  );
  const totalRevenue = round2(rev.reduce((s, r) => s + num(r.total), 0));
  const totalExpenses = round2(exp.reduce((s, r) => s + num(r.total), 0));
  const netProfit = round2(totalRevenue - totalExpenses);

  const loanStatusQuery = bid != null
    ? `SELECT l.loan_status, COUNT(*) n, SUM(l.loan_amount::float) amt FROM loans l WHERE ${loanScope.sql} GROUP BY l.loan_status`
    : `SELECT loan_status, COUNT(*) n, SUM(loan_amount::float) amt FROM loans WHERE issue_date >= $1 AND issue_date <= $2 GROUP BY loan_status`;
  const loans = await q(loanStatusQuery, loanScope.params);

  const loanTotals = await q(
    `SELECT COUNT(*) n, COALESCE(SUM(l.loan_amount::float),0) amt, COALESCE(SUM(l.outstanding_amount::float),0) out_,
            COALESCE(SUM(l.interest_earned::float),0) int_
     FROM loans l WHERE ${loanScope.sql}`,
    loanScope.params
  );

  const methods = await q(
    `SELECT t.payment_method, COUNT(*) n, SUM(t.amount::float) v FROM transactions t
     WHERE ${txnScope.sql} AND t.status = 'Successful'
     GROUP BY t.payment_method ORDER BY v DESC`,
    txnScope.params
  );

  const txns = await q(
    `SELECT t.transaction_id, t.transaction_date, c.name, t.payment_method, t.amount::float amt, t.status
     FROM transactions t
     JOIN customers c ON c.customer_id = t.customer_id
     WHERE ${txnScope.sql}
     ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT 25`,
    txnScope.params
  );

  const branchQuery = bid != null
    ? `SELECT branch_id, branch_name, city FROM branches WHERE branch_id = $1 ORDER BY branch_id`
    : `SELECT branch_id, branch_name, city FROM branches ORDER BY branch_id`;
  const branchList = await q(branchQuery, bid != null ? [Number(bid)] : []);

  const revAgg = await q(
    `SELECT branch_id, SUM(amount::float) AS v FROM revenue WHERE ${revScope.sql} GROUP BY branch_id`,
    revScope.params
  );
  const expAgg = await q(
    `SELECT branch_id, SUM(amount::float) AS v FROM expenses WHERE ${expScope.sql} GROUP BY branch_id`,
    expScope.params
  );
  const branches = branchList.map((b) => ({
    ...b,
    rev: num(revAgg.find((r) => r.branch_id === b.branch_id)?.v || 0),
    exp: num(expAgg.find((r) => r.branch_id === b.branch_id)?.v || 0),
  }));

  const emi = await q(
    `SELECT lp.payment_status, COUNT(*) n, COALESCE(SUM(lp.emi_amount::float),0) emi,
            COALESCE(SUM(lp.principal_paid::float),0) principal, COALESCE(SUM(lp.interest_paid::float),0) interest
     FROM loan_payments lp WHERE ${payScope.sql} GROUP BY lp.payment_status ORDER BY lp.payment_status`,
    payScope.params
  );

  const schemes = await q(
    `SELECT s.scheme_name, s.scheme_type, s.interest_rate::float, COUNT(e.enrollment_id) n,
            COALESCE(SUM(e.amount::float),0) amt
     FROM banking_schemes s
     LEFT JOIN scheme_enrollments e ON e.scheme_id = s.scheme_id AND ${enrScope.sql}
     GROUP BY s.scheme_id, s.scheme_name, s.scheme_type, s.interest_rate
     ORDER BY amt DESC`,
    enrScope.params
  );

  const revRows = await q(
    `SELECT date, amount::float AS amount FROM revenue WHERE ${revScope.sql}`,
    revScope.params
  );
  const expRows = await q(
    `SELECT date, amount::float AS amount FROM expenses WHERE ${expScope.sql}`,
    expScope.params
  );
  const bucket = resolved.days && resolved.days <= 62 ? 'daily' : resolved.days && resolved.days <= 400 ? 'monthly' : 'yearly';
  const revMap = groupByBucket(revRows, bucket);
  const expMap = groupByBucket(expRows, bucket);
  const monthlyRows = bucketSeries(from, to, bucket).map((label) => {
    const r = round2(sumField(revMap.get(label) || [], 'amount'));
    const e = round2(sumField(expMap.get(label) || [], 'amount'));
    return [label, r, e, round2(r - e)];
  });

  const summary = [
    { label: 'Total Revenue', value: totalRevenue },
    { label: 'Total Expenses', value: totalExpenses },
    { label: 'Net Profit / Loss', value: netProfit },
    { label: 'Profit Margin %', value: totalRevenue ? round2((netProfit / totalRevenue) * 100) : 0 },
    { label: 'Total Loans (issued in period)', value: num(loanTotals[0]?.n || 0) },
    { label: 'Loan Amount (issued in period)', value: num(loanTotals[0]?.amt || 0) },
    { label: 'Outstanding Loans', value: num(loanTotals[0]?.out_ || 0) },
    { label: 'Interest Earned (recorded)', value: num(loanTotals[0]?.int_ || 0) },
  ];

  const sections = [];
  sections.push({ title: 'Revenue by Category', headers: ['Category', 'Amount (INR)'], rows: rev.map((r) => [r.revenue_type, num(r.total)]) });
  sections.push({ title: 'Expenses by Category', headers: ['Category', 'Amount (INR)'], rows: exp.map((r) => [r.expense_type, num(r.total)]) });
  sections.push({ title: 'Monthly Performance', headers: ['Period', 'Revenue (INR)', 'Expenses (INR)', 'Profit (INR)'], rows: monthlyRows });
  sections.push({ title: 'Loans by Status', headers: ['Status', 'Count', 'Amount (INR)'], rows: loans.map((l) => [l.loan_status, num(l.n), num(l.amt)]) });
  sections.push({ title: 'EMI Collection', headers: ['Status', 'Payments', 'EMI (INR)', 'Principal (INR)', 'Interest (INR)'], rows: emi.map((m) => [m.payment_status, num(m.n), num(m.emi), num(m.principal), num(m.interest)]) });
  sections.push({ title: 'Payment Method Usage', headers: ['Method', 'Transactions', 'Value (INR)'], rows: methods.map((m) => [m.payment_method, num(m.n), num(m.v)]) });
  sections.push({ title: 'Branch Performance', headers: ['Branch', 'Revenue (INR)', 'Expenses (INR)', 'Profit (INR)'], rows: branches.map((b) => [b.branch_name, num(b.rev), num(b.exp), round2(num(b.rev) - num(b.exp))]) });
  sections.push({ title: 'Banking Schemes', headers: ['Scheme', 'Type', 'Rate %', 'Enrollments', 'Amount (INR)'], rows: schemes.map((s) => [s.scheme_name, s.scheme_type, num(s.interest_rate), num(s.n), num(s.amt)]) });
  sections.push({ title: 'Latest Transactions', headers: ['ID', 'Date', 'Customer', 'Method', 'Amount (INR)', 'Status'], rows: txns.map((t) => [t.transaction_id, fmtDate(t.transaction_date), t.name, t.payment_method, num(t.amt), t.status]) });

  return {
    type,
    title: TYPE_TITLES[type] || 'Financial Report',
    generatedAt: new Date().toLocaleString('en-IN'),
    periodLabel: resolved.key === 'all' ? 'All available records' : `${from} to ${to} (${resolved.label})`,
    from,
    to,
    summary,
    sections,
    disclaimer:
      'Academic demonstration report generated from synthetic/demo data. Not suitable for real financial decisions.',
  };
}

// ---------------- CSV ----------------
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(data) {
  const lines = [];
  const row = (cells) => lines.push(cells.map(csvCell).join(','));
  lines.push(csvCell(data.title));
  row(['Generated', data.generatedAt]);
  row(['Period', data.periodLabel]);
  lines.push('');
  lines.push('Summary');
  row(['Metric', 'Value']);
  data.summary.forEach((s) => row([s.label, s.value]));
  data.sections.forEach((sec) => {
    if (!sec.rows.length) return;
    lines.push('');
    lines.push(csvCell(sec.title));
    row(sec.headers);
    sec.rows.forEach((r) => row(r));
  });
  lines.push('');
  lines.push(csvCell(data.disclaimer));
  return '\uFEFF' + lines.join('\r\n');
}

// ---------------- PDF ----------------
function toPdf(data, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.type}-report.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).fillColor('#1f42f5').text('FinTech Bank');
  doc.moveDown(0.3);
  doc.fontSize(14).fillColor('#111827').text(data.title);
  doc.fontSize(9).fillColor('#6b7280').text(`Generated: ${data.generatedAt}   |   Period: ${data.periodLabel}`);
  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#d1d5db').stroke();
  doc.moveDown(0.8);

  doc.fontSize(11).fillColor('#111827').text('Executive Summary', { underline: true });
  doc.moveDown(0.3);
  data.summary.forEach((s) => {
    doc.fontSize(9.5);
    doc.fillColor('#111827').text(`${s.label}:`, { continued: true });
    doc
      .fillColor(s.label === 'Net Profit / Loss' ? (num(s.value) >= 0 ? '#16a34a' : '#dc2626') : '#111827')
      .text(`  Rs ${num(s.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
  });

  data.sections.forEach((sec) => {
    if (!sec.rows.length) return;
    doc.addPage();
    doc.fontSize(12).fillColor('#111827').text(sec.title);
    doc.moveDown(0.3);
    const colWidth = 520 / sec.headers.length;
    let y = doc.y;
    doc.fontSize(8.5);
    doc.fillColor('#ffffff').rect(40, y, 520, 16).fill('#1f42f5');
    doc.fillColor('#ffffff');
    sec.headers.forEach((h, i) => doc.text(String(h), 42 + i * colWidth, y + 4, { width: colWidth - 4 }));
    y += 18;
    doc.fillColor('#111827');
    sec.rows.slice(0, 40).forEach((row) => {
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
      row.forEach((cell, i) =>
        doc.text(
          typeof cell === 'number' ? `Rs ${cell.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : String(cell),
          42 + i * colWidth,
          y + 2,
          { width: colWidth - 4 }
        )
      );
      y += 14;
    });
  });

  doc.fontSize(8).fillColor('#9ca3af').text(data.disclaimer, 40, 800, { width: 515 });
  doc.end();
}

// ---------------- HTML (print) ----------------
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toHtml(data) {
  const money = (v) => '&#8377; ' + num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const rowsHtml = (headers, rows) => `
    <table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${typeof c === 'number' ? money(c) : escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>
    </table>`;
  const profit = num(data.summary.find((s) => s.label === 'Net Profit / Loss')?.value || 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;color:#111827;padding:32px;max-width:900px;margin:0 auto}
    h1{color:#1f42f5;font-size:22px;margin:0} .sub{color:#6b7280;font-size:12px;margin-top:4px}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
    .kpi{background:#f3f4f6;border-radius:8px;padding:12px}
    .kpi .l{font-size:11px;color:#6b7280} .kpi .v{font-size:15px;font-weight:700}
    h2{font-size:15px;margin:24px 0 8px;border-bottom:2px solid #1f42f5;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
    th{background:#1f42f5;color:#fff;text-align:left;padding:6px 8px}
    td{border-bottom:1px solid #e5e7eb;padding:6px 8px}
    tr:nth-child(even){background:#f9fafb}
    .foot{color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:8px}
    @media print{.noprint{display:none}}
  </style></head><body>
  <h1>FinTech Bank</h1>
  <div class="sub">${escapeHtml(data.title)} &middot; ${escapeHtml(data.periodLabel)} &middot; Generated ${escapeHtml(data.generatedAt)}</div>
  <div class="kpis">${data.summary
    .map(
      (s) =>
        `<div class="kpi"><div class="l">${escapeHtml(s.label)}</div><div class="v" style="color:${
          s.label.includes('Profit') ? (profit >= 0 ? '#16a34a' : '#dc2626') : 'inherit'
        }">${money(s.value)}</div></div>`
    )
    .join('')}</div>
  ${data.sections.map((sec) => `<h2>${escapeHtml(sec.title)}</h2>${rowsHtml(sec.headers, sec.rows)}`).join('')}
  <div class="foot">${escapeHtml(data.disclaimer)}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
  </body></html>`;
}

router.get('/', async (req, res, next) => {
  try {
    const type = String(req.query.type || 'profitloss');
    const format = String(req.query.format || 'csv');
    if (!TYPE_TITLES[type]) return res.status(400).json({ error: 'Unknown report type' });
    if (!['csv', 'pdf', 'print'].includes(format)) return res.status(400).json({ error: 'Unknown report format' });

    const data = await buildReportData(req.user, type, {
      period: req.query.period,
      from: req.query.from,
      to: req.query.to,
    });
    if (format === 'pdf') return toPdf(data, res);
    if (format === 'print') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(toHtml(data));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(toCsv(data));
  } catch (e) {
    next(e);
  }
});

router.get('/types', (req, res) => {
  res.json({ types: Object.entries(TYPE_TITLES).map(([key, title]) => ({ key, title })) });
});

export default router;
