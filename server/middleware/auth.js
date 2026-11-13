import jwt from 'jsonwebtoken';
import config from '../config.js';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  BANK_MANAGER: 'bank_manager',
  FINANCIAL_OFFICER: 'financial_officer',
  VIEWER: 'viewer',
};

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  bank_manager: 'Bank Manager',
  financial_officer: 'Financial Officer',
  viewer: 'Viewer',
};

export function signToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      branch_name: user.branch_name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpires }
  );
}

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authorized' });
  try {
    req.user = jwt.verify(header.slice(7), config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action' });
    next();
  };
}

export function scopedBranchId(user) {
  if (!user) return null;
  if (user.role === 'bank_manager') return user.branch_id;
  return null;
}

export function branchClause(user, alias = '') {
  const bid = scopedBranchId(user);
  if (bid == null) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}branch_id = $1`, params: [Number(bid)] };
}
