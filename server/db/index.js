import pg from 'pg';
import config from '../config.js';
import { createSchema } from './schema.js';
import { seedData } from './seed.js';

const { Pool } = pg;

let pool = null;
let db = null;

function connectionOptions() {
  if (config.databaseUrl) return { connectionString: config.databaseUrl };
  return config.pg;
}

function describeTarget() {
  if (config.databaseUrl) {
    try {
      const u = new URL(config.databaseUrl);
      return `${u.hostname}:${u.port || 5432}/${u.pathname.replace(/^\//, '')}`;
    } catch {
      return 'DATABASE_URL (unparseable)';
    }
  }
  return `${config.pg.host}:${config.pg.port}/${config.pg.database} as ${config.pg.user}`;
}

function actionableMessage(err) {
  const target = describeTarget();
  const lines = [
    `Could not connect to PostgreSQL at ${target}.`,
    `Reason: ${err.code || ''} ${err.message || err}`,
  ];
  if (err.code === '3D000') {
    lines.push('The database does not exist. Create it with:');
    lines.push('  npm run db:create   (from the project root)');
  } else if (err.code === '28P01' || err.code === '28000') {
    lines.push('Authentication failed. Check PGUSER / PGPASSWORD in server/.env.');
  } else if (err.code === 'ECONNREFUSED') {
    lines.push('PostgreSQL is not accepting connections. Start the service, for example:');
    lines.push('  Get-Service postgresql* | Start-Service');
  }
  lines.push('This app requires PostgreSQL. There is no silent in-memory fallback.');
  lines.push('Edit server/.env (copy .env.example) and then run: npm run db:init');
  return lines.join('\n');
}

export async function initDb({ seed = config.autoSeed, force = false } = {}) {
  if (db) return { ...db, seedResult: null };

  pool = new Pool({
    ...connectionOptions(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));

  try {
    await pool.query('SELECT 1');
  } catch (err) {
    await pool.end().catch(() => {});
    pool = null;
    const wrapped = new Error(actionableMessage(err));
    wrapped.cause = err;
    throw wrapped;
  }

  const query = async (text, params) => (await pool.query(text, params)).rows;
  await createSchema(query);

  let seedResult = null;
  if (seed) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txQuery = async (text, params) => (await client.query(text, params)).rows;
      seedResult = await seedData(txQuery, { force });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    if (seedResult.seeded) {
      console.log(`[db] Demo data seeded: ${JSON.stringify(seedResult.counts)}`);
    } else {
      console.log(`[db] Existing data preserved (${seedResult.reason}).`);
    }
  }

  db = { type: 'postgres', query, pool };
  console.log(`[db] Connected to PostgreSQL (${describeTarget()})`);
  return { ...db, seedResult };
}

export function getDb() {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

// Convenience: run a query returning rows.
export async function q(text, params) {
  return getDb().query(text, params);
}

// Run several statements inside a single transaction.
export async function withTransaction(fn) {
  if (!pool) throw new Error('Database not initialised. Call initDb() first.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = async (text, params) => (await client.query(text, params)).rows;
    const result = await fn(run);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
