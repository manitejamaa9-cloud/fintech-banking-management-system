import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, q, closeDb } from '../db/index.js';

// Integration test against the real PostgreSQL database configured in server/.env.
// It never deletes or reseeds data.
test.after(async () => {
  await closeDb();
});

test('PostgreSQL is reachable and schema exists', async () => {
  const { type } = await initDb({ seed: false });
  assert.equal(type, 'postgres');

  const tables = await q(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const names = tables.map((t) => t.tablename);
  for (const required of [
    'branches',
    'users',
    'customers',
    'accounts',
    'loans',
    'loan_payments',
    'transactions',
    'revenue',
    'expenses',
    'banking_schemes',
    'scheme_enrollments',
    'import_transactions_staging',
  ]) {
    assert.ok(names.includes(required), `missing table ${required}`);
  }
});

test('migrated columns exist and queries are parameterised', async () => {
  const cols = await q(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'transactions' AND column_name IN ('fraud_flag','merchant_category','reference_no')`
  );
  assert.equal(cols.length, 3);

  const rows = await q('SELECT COUNT(*)::int c FROM branches WHERE branch_id = $1', [1]);
  assert.ok(rows[0].c >= 1);
});

test('seed data is present and reference integrity holds', async () => {
  const counts = await q(
    `SELECT
       (SELECT COUNT(*)::int FROM branches) AS branches,
       (SELECT COUNT(*)::int FROM users) AS users,
       (SELECT COUNT(*)::int FROM loans) AS loans,
       (SELECT COUNT(*)::int FROM revenue) AS revenue`
  );
  assert.ok(counts[0].branches >= 1);
  assert.ok(counts[0].users >= 1);
  assert.ok(counts[0].loans >= 1);
  assert.ok(counts[0].revenue >= 1);

  const orphans = await q(
    `SELECT COUNT(*)::int c FROM loans l LEFT JOIN customers c2 ON c2.customer_id = l.customer_id WHERE c2.customer_id IS NULL`
  );
  assert.equal(orphans[0].c, 0);
});

test('password hashes are never stored as plaintext', async () => {
  const rows = await q('SELECT password_hash FROM users LIMIT 5');
  for (const r of rows) {
    assert.match(r.password_hash, /^\$2[aby]\$/);
    assert.notEqual(r.password_hash, 'Admin@123');
  }
});
