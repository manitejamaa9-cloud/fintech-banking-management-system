import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { signToken, scopedBranchId, branchClause, ROLES } from '../middleware/auth.js';

function claims(overrides = {}) {
  return { user_id: 1, employee_id: 'TEST001', name: 'Test User', role: ROLES.SUPER_ADMIN, branch_id: 1, ...overrides };
}

test('signed tokens carry role and branch claims', () => {
  const token = signToken(claims({ role: ROLES.BANK_MANAGER, branch_id: 3 }));
  const decoded = jwt.verify(token, config.jwtSecret);
  assert.equal(decoded.role, 'bank_manager');
  assert.equal(decoded.branch_id, 3);
  assert.ok(decoded.exp > decoded.iat);
});

test('tokens signed with a different secret are rejected', () => {
  const token = jwt.sign({ user_id: 99 }, 'a-different-secret-value-1234567890');
  assert.throws(() => jwt.verify(token, config.jwtSecret));
});

test('only branch managers are scoped to a branch', () => {
  assert.equal(scopedBranchId({ role: ROLES.BANK_MANAGER, branch_id: 4 }), 4);
  assert.equal(scopedBranchId({ role: ROLES.SUPER_ADMIN, branch_id: 4 }), null);
  assert.equal(scopedBranchId({ role: ROLES.FINANCIAL_OFFICER, branch_id: 4 }), null);
  assert.equal(scopedBranchId({ role: ROLES.VIEWER, branch_id: 4 }), null);
});

test('branch clause builds a valid numbered SQL parameter', () => {
  const clause = branchClause({ role: ROLES.BANK_MANAGER, branch_id: 2 }, 'l');
  assert.equal(clause.sql, ' AND l.branch_id = $1');
  assert.deepEqual(clause.params, [2]);
  assert.deepEqual(branchClause({ role: ROLES.SUPER_ADMIN }), { sql: '', params: [] });
});
