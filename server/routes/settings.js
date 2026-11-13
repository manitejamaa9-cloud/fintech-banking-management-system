import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db/index.js';
import { auth, requireRole, ROLES, ROLE_LABELS } from '../middleware/auth.js';
import { todayStr } from '../utils/format.js';

const router = Router();
router.use(auth);
const ROLE_KEYS = Object.values(ROLES);

function publicUser(user) {
  return { ...user, role_label: ROLE_LABELS[user.role] || user.role };
}

router.get('/users', requireRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT u.user_id, u.employee_id, u.name, u.email, u.role, u.status, u.branch_id,
              b.branch_name, u.created_at, u.last_login_at
       FROM users u JOIN branches b ON b.branch_id = u.branch_id ORDER BY u.user_id`
    );
    res.json({ users: rows.map(publicUser) });
  } catch (e) { next(e); }
});

router.post('/users', requireRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { employee_id, name, email, password, role, branch_id } = req.body || {};
    if (typeof employee_id !== 'string' || !employee_id.trim()) return res.status(400).json({ error: 'Employee ID is required' });
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!ROLE_KEYS.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ error: 'Invalid email address' });
    const branchId = branch_id ? Number(branch_id) : 1;
    if (!Number.isInteger(branchId)) return res.status(400).json({ error: 'Invalid branch' });
    const branch = await q('SELECT 1 FROM branches WHERE branch_id = $1', [branchId]);
    if (!branch.length) return res.status(400).json({ error: 'Branch does not exist' });
    const existing = await q('SELECT user_id FROM users WHERE employee_id = $1', [employee_id.trim()]);
    if (existing.length) return res.status(409).json({ error: 'Employee ID already exists' });
    const hash = await bcrypt.hash(password, 10);
    const created = await q(
      `INSERT INTO users (employee_id, name, email, password_hash, role, branch_id, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7)
       RETURNING user_id, employee_id, name, email, role, status, branch_id, created_at`,
      [employee_id.trim(), name.trim(), email ? String(email).trim() : '', hash, role, branchId, todayStr()]
    );
    res.status(201).json({ user: publicUser(created[0]) });
  } catch (e) { next(e); }
});

router.patch('/users/:id/status', requireRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user id' });
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Status must be active or inactive' });
    if (id === req.user.user_id && status === 'inactive') return res.status(400).json({ error: 'You cannot deactivate your own account' });
    const updated = await q('UPDATE users SET status = $1 WHERE user_id = $2 RETURNING user_id', [status, id]);
    if (!updated.length) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, user_id: id, status });
  } catch (e) { next(e); }
});

router.patch('/users/:id/role', requireRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const role = req.body?.role;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user id' });
    if (!ROLE_KEYS.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (id === req.user.user_id && role !== ROLES.SUPER_ADMIN) return res.status(400).json({ error: 'You cannot remove your own super admin role' });
    const updated = await q('UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id', [role, id]);
    if (!updated.length) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, user_id: id, role });
  } catch (e) { next(e); }
});

router.get('/summary', requireRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const rows = await q('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role');
    const branches = await q('SELECT COUNT(*)::int AS count FROM branches');
    res.json({ roles: rows, branches: branches[0]?.count || 0 });
  } catch (e) { next(e); }
});

export default router;
