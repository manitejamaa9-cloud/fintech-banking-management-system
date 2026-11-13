import { q } from '../db/index.js';
import { num } from './format.js';
import { scopedBranchId } from '../middleware/auth.js';

// Build a branch scope + date filter WHERE clause
export function buildWhere(user, { alias = '', from, to, branchColumn = 'branch_id', dateColumn = 'date', extra = [] } = {}) {
  const bid = scopedBranchId(user);
  const params = [];
  let where = '1=1';
  const pref = alias ? `${alias}.` : '';
  if (bid != null) {
    params.push(bid);
    where += ` AND ${pref}${branchColumn} = $${params.length}`;
  }
  if (from) {
    params.push(from);
    where += ` AND ${pref}${dateColumn} >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    where += ` AND ${pref}${dateColumn} <= $${params.length}`;
  }
  for (const e of extra) {
    params.push(e.value);
    where += ` AND ${e.sql.replace(/\?/, `$${params.length}`)}`;
  }
  return { where, params };
}

export async function fetchRevenue(user, from = null, to = null, alias = 'r') {
  const { where, params } = buildWhere(user, { alias, from, to });
  return q(`SELECT ${alias}.revenue_id, ${alias}.date, ${alias}.revenue_type, ${alias}.amount::float AS amount, ${alias}.branch_id FROM revenue ${alias} WHERE ${where}`, params);
}

export async function fetchExpenses(user, from = null, to = null, alias = 'e') {
  const { where, params } = buildWhere(user, { alias, from, to });
  return q(`SELECT ${alias}.expense_id, ${alias}.date, ${alias}.expense_type, ${alias}.amount::float AS amount, ${alias}.branch_id FROM expenses ${alias} WHERE ${where}`, params);
}

export async function fetchTransactions(user, from = null, to = null, alias = 't') {
  const { where, params } = buildWhere(user, { alias, from, to, dateColumn: 'transaction_date' });
  return q(`SELECT ${alias}.transaction_id, ${alias}.customer_id, ${alias}.account_id, ${alias}.branch_id, ${alias}.transaction_date, ${alias}.payment_method, ${alias}.transaction_type, ${alias}.amount::float AS amount, ${alias}.merchant, ${alias}.status FROM transactions ${alias} WHERE ${where}`, params);
}

export async function fetchLoanPayments(user, from = null, to = null, alias = 'lp') {
  const { where, params } = buildWhere(user, { alias, from, to, dateColumn: 'payment_date' });
  return q(`SELECT ${alias}.payment_id, ${alias}.loan_id, ${alias}.customer_id, ${alias}.branch_id, ${alias}.payment_date, ${alias}.emi_amount::float AS emi_amount, ${alias}.principal_paid::float AS principal_paid, ${alias}.interest_paid::float AS interest_paid, ${alias}.payment_method, ${alias}.payment_status FROM loan_payments ${alias} WHERE ${where}`, params);
}

export function sumField(rows, field) {
  return rows.reduce((s, r) => s + num(r[field]), 0);
}

export function countWhere(rows, fn) {
  return rows.filter(fn).length;
}

// ----- date bucketing (done in JS for pg-mem compatibility) -----
export function bucketKey(dateStr, bucket) {
  let d;
  if (dateStr instanceof Date) {
    d = new Date(dateStr);
  } else {
    const s = String(dateStr).slice(0, 10);
    d = new Date(s + 'T00:00:00');
  }
  if (isNaN(d.getTime())) return String(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const iso = (yy, mm, dd) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  switch (bucket) {
    case 'daily':
      return iso(y, m, day);
    case 'weekly': {
      const dow = d.getDay();
      const diff = dow === 0 ? 6 : dow - 1;
      const wd = new Date(d);
      wd.setDate(d.getDate() - diff);
      return iso(wd.getFullYear(), wd.getMonth() + 1, wd.getDate());
    }
    case 'monthly':
      return `${y}-${String(m).padStart(2, '0')}`;
    case 'quarterly':
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case 'yearly':
      return String(y);
    default:
      return iso(y, m, day);
  }
}

// Continuous series of bucket labels between from and to (no gaps)
export function bucketSeries(from, to, bucket) {
  const res = [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  const cur = new Date(start);
  const labelFor = (d) => {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (bucket === 'yearly') return String(y);
    if (bucket === 'quarterly') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    if (bucket === 'monthly') return `${y}-${String(m).padStart(2, '0')}`;
    if (bucket === 'weekly') {
      const dow = d.getDay();
      const diff = dow === 0 ? 6 : dow - 1;
      const wd = new Date(d);
      wd.setDate(d.getDate() - diff);
      return `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, '0')}-${String(wd.getDate()).padStart(2, '0')}`;
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let guard = 0;
  while (cur <= end && guard < 2000) {
    res.push(labelFor(cur));
    if (bucket === 'yearly') cur.setFullYear(cur.getFullYear() + 1);
    else if (bucket === 'monthly' || bucket === 'quarterly') cur.setMonth(cur.getMonth() + 1);
    else if (bucket === 'weekly') cur.setDate(cur.getDate() + 7);
    else cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return res;
}

export function groupByBucket(rows, bucket, dateField = 'date') {
  const map = new Map();
  for (const r of rows) {
    const key = bucketKey(r[dateField], bucket);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}
