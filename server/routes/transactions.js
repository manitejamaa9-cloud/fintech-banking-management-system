import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num } from '../utils/format.js';

const router = Router();
router.use(auth);

const METHODS = ['UPI', 'Debit Card', 'Credit Card', 'NEFT', 'RTGS', 'IMPS', 'ATM', 'Cash', 'Cheque', 'Auto Debit'];
const STATUSES = ['Successful', 'Pending', 'Failed', 'Reversed'];
const SORTS = {
  date_desc: 't.transaction_date DESC, t.transaction_id DESC',
  date_asc: 't.transaction_date ASC, t.transaction_id ASC',
  amount_desc: 't.amount DESC',
  amount_asc: 't.amount ASC',
  id_desc: 't.transaction_id DESC',
};

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
    const pageSize = clampInt(req.query.pageSize, 25, 1, 200);
    const { method, status, type, search, minAmount, maxAmount, from, to, branch, fraud, category } = req.query;

    const params = [];
    const where = ['1=1'];
    if (bid != null) { params.push(Number(bid)); where.push(`t.branch_id = $${params.length}`); }
    if (method) { params.push(method); where.push(`t.payment_method = $${params.length}`); }
    if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
    if (type) { params.push(type); where.push(`t.transaction_type = $${params.length}`); }
    if (category) { params.push(category); where.push(`t.merchant_category = $${params.length}`); }
    if (branch) { params.push(Number(branch)); where.push(`t.branch_id = $${params.length}`); }
    if (fraud === 'true') where.push('t.fraud_flag = TRUE');
    if (fraud === 'false') where.push('t.fraud_flag = FALSE');
    if (minAmount) { params.push(Number(minAmount)); where.push(`t.amount >= $${params.length}`); }
    if (maxAmount) { params.push(Number(maxAmount)); where.push(`t.amount <= $${params.length}`); }
    if (from) { params.push(from); where.push(`t.transaction_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`t.transaction_date <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(t.transaction_id::text ILIKE $${params.length} OR c.name ILIKE $${params.length} OR t.merchant ILIKE $${params.length} OR t.reference_no ILIKE $${params.length})`
      );
    }
    const whereSql = where.join(' AND ');
    const orderBy = SORTS[req.query.sort] || SORTS.date_desc;

    const countRows = await q(
      `SELECT COUNT(*)::int c FROM transactions t JOIN customers c ON c.customer_id = t.customer_id WHERE ${whereSql}`,
      params
    );
    const total = num(countRows[0]?.c);
    const offset = (page - 1) * pageSize;
    const listParams = [...params, pageSize, offset];

    const txns = await q(
      `SELECT t.transaction_id, t.customer_id, c.name AS customer_name, t.account_id, t.branch_id, b.branch_name,
              t.transaction_date, t.payment_method, t.transaction_type, t.amount::float AS amount, t.merchant,
              t.merchant_category, t.reference_no, t.fraud_flag, t.status
       FROM transactions t
       JOIN customers c ON c.customer_id = t.customer_id
       JOIN branches b ON b.branch_id = t.branch_id
       WHERE ${whereSql} ORDER BY ${orderBy} LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const categories = await q('SELECT DISTINCT merchant_category FROM transactions WHERE merchant_category IS NOT NULL ORDER BY merchant_category');
    res.json({
      transactions: txns,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      filters: { methods: METHODS, statuses: STATUSES, categories: categories.map((c) => c.merchant_category) },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
