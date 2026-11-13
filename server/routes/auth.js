import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db/index.js';
import config from '../config.js';
import { auth, signToken, ROLE_LABELS } from '../middleware/auth.js';

const router = Router();

// Public: list branches for the login screen.
router.get('/branches', async (req, res, next) => {
  try {
    const rows = await q('SELECT branch_id, branch_code, branch_name, city FROM branches ORDER BY branch_id');
    res.json({ branches: rows });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { employee_id, password, branch_id, otp, twoFA } = req.body || {};
    if (typeof employee_id !== 'string' || typeof password !== 'string' || !employee_id.trim() || !password) {
      return res.status(400).json({ error: 'Employee ID and password are required' });
    }
    const rows = await q(
      `SELECT u.user_id, u.employee_id, u.name, u.email, u.password_hash, u.role, u.status,
              u.branch_id, b.branch_name, b.city AS branch_city
       FROM users u JOIN branches b ON b.branch_id = u.branch_id
       WHERE u.employee_id = $1`,
      [employee_id.trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid employee ID or password' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid employee ID or password' });
    if (user.status !== 'active') return res.status(403).json({ error: 'This account has been deactivated' });

    let branchId = user.branch_id;
    if (branch_id != null && String(branch_id) !== '') {
      const selected = Number(branch_id);
      if (!Number.isInteger(selected)) return res.status(400).json({ error: 'Invalid branch' });
      if (user.role === 'bank_manager' && selected !== Number(user.branch_id)) {
        return res.status(403).json({ error: 'Branch Manager credentials are only valid for their own branch' });
      }
      const exists = await q('SELECT 1 FROM branches WHERE branch_id = $1', [selected]);
      if (!exists.length) return res.status(400).json({ error: 'Invalid branch' });
      branchId = selected;
    }

    if (twoFA) {
      if (!otp) return res.status(400).json({ error: 'OTP is required for 2FA' });
      if (String(otp).trim() !== config.demoOtp) return res.status(401).json({ error: 'Invalid OTP' });
    }

    await q('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]).catch(() => {});
    const payload = { user_id: user.user_id, employee_id: user.employee_id, name: user.name, email: user.email, role: user.role, branch_id: branchId, branch_name: user.branch_name, branch_city: user.branch_city };
    const token = signToken(payload);
    res.json({ token, user: { ...payload, role_label: ROLE_LABELS[user.role] } });
  } catch (e) { next(e); }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT u.user_id, u.employee_id, u.name, u.email, u.role, u.status, u.branch_id,
              b.branch_name, b.city AS branch_city
       FROM users u JOIN branches b ON b.branch_id = u.branch_id
       WHERE u.user_id = $1`, [req.user.user_id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    const u = rows[0];
    if (u.status !== 'active') return res.status(403).json({ error: 'This account has been deactivated' });
    res.json({ user: { user_id: u.user_id, employee_id: u.employee_id, name: u.name, email: u.email, role: u.role, role_label: ROLE_LABELS[u.role], status: u.status, branch_id: u.branch_id, branch_name: u.branch_name, branch_city: u.branch_city } });
  } catch (e) { next(e); }
});

// Stateless JWTs: the client discards the token. Kept for a consistent API.
router.post('/logout', auth, (req, res) => res.json({ ok: true, message: 'Logged out. Discard the token on the client.' }));

export default router;
