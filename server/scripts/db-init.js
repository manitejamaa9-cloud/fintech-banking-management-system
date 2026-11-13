// Creates the application database when missing, applies the schema and
// optionally seeds the demonstration dataset.
//
//   node scripts/db-init.js            # create db (if needed) + schema + seed
//   node scripts/db-init.js --force    # WARNING: deletes demo rows, then reseeds
//   node scripts/db-init.js --no-seed  # schema only
import pg from 'pg';
import config from '../config.js';
import { initDb, closeDb } from '../db/index.js';

const force = process.argv.includes('--force');
const noSeed = process.argv.includes('--no-seed');

const dbName = config.pg.database;
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  console.error(`[db-init] Unsafe database name: ${dbName}`);
  process.exit(1);
}

async function ensureDatabase() {
  if (config.databaseUrl) {
    console.log('[db-init] DATABASE_URL is set; assuming the database already exists.');
    return;
  }
  const admin = new pg.Pool({ ...config.pg, database: 'postgres' });
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (found.rows.length) {
      console.log(`[db-init] Database "${dbName}" already exists.`);
    } else {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[db-init] Created database "${dbName}".`);
    }
  } catch (err) {
    console.error(`[db-init] Could not create database: ${err.code || ''} ${err.message}`);
    console.error('[db-init] Check that PostgreSQL is running and PGUSER/PGPASSWORD in server/.env are correct.');
    process.exit(1);
  } finally {
    await admin.end();
  }
}

try {
  await ensureDatabase();
  const { type, seedResult } = await initDb({ seed: !noSeed, force });
  console.log(`[db-init] Connected: ${type}`);
  if (seedResult) {
    console.log(
      seedResult.seeded
        ? `[db-init] Seeded demo data: ${JSON.stringify(seedResult.counts)}`
        : `[db-init] Seed skipped: ${seedResult.reason}`
    );
  }
  console.log('[db-init] Done.');
} catch (err) {
  console.error('[db-init] FAILED');
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
