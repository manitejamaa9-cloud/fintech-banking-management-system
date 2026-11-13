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
    const { page = 1, pageSize = 20, type, status, branch, search } = req.query;
    const params = [];
    const where = ['1=1'];
    if (bid != null) { params.push(Number(bid)); where.push(`a.branch_id = $${params.length}`); }
    if (type) { params.push(type); where.push(`a.account_type = $${params.length}`); }
    if (status) { params.push(status); where.push(`a.status = $${params.length}`); }
    if (branch) { params.push(Number(branch)); where.push(`a.branch_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(a.account_id::text ILIKE $${params.length} OR c.name ILIKE $${params.length})`); }
    const whereSql = where.join(' AND ');

    const countRows = await q(`SELECT COUNT(*) c FROM accounts a JOIN customers c ON c.customer_id = a.customer_id WHERE ${whereSql}`, params);
    const total = num(countRows[0].c);
    const offset = (Math.max(1, Number(page)) - 1) * Number(pageSize);
    params.push(Number(pageSize), offset);
    const accounts = await q(
      `SELECT a.account_id, a.customer_id, c.name AS customer_name, a.branch_id, b.branch_name,
              a.account_type, a.opening_balance::float AS opening_balance, a.current_balance::float AS current_balance,
              a.status, a.created_at
       FROM accounts a
       JOIN customers c ON c.customer_id = a.customer_id
       JOIN branches b ON b.branch_id = a.branch_id
       WHERE ${whereSql} ORDER BY a.account_id LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ accounts, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (e) { next(e); }
});

export default router;
