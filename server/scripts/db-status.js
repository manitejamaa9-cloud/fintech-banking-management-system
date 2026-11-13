// Read-only database health check used by check-environment.bat.
import pg from 'pg';
import config from '../config.js';

const pool = new pg.Pool({
  ...(config.databaseUrl ? { connectionString: config.databaseUrl } : config.pg),
  connectionTimeoutMillis: 5000,
});

const tables = [
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
];

function target() {
  if (config.databaseUrl) {
    try {
      const url = new URL(config.databaseUrl);
      return `${url.hostname}:${url.port || 5432}/${url.pathname.replace(/^\//, '')}`;
    } catch {
      return 'DATABASE_URL';
    }
  }
  return `${config.pg.host}:${config.pg.port}/${config.pg.database} as ${config.pg.user}`;
}

try {
  const version = await pool.query('SHOW server_version');
  const current = await pool.query('SELECT current_database() AS name');
  console.log(`Connected to ${target()} (PostgreSQL ${version.rows[0].server_version}).`);
  console.log(`Database: ${current.rows[0].name}`);

  for (const table of tables) {
    const exists = await pool.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
    if (!exists.rows[0].name) {
      console.log(`  ${table.padEnd(20)} missing`);
      continue;
    }
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    console.log(`  ${table.padEnd(20)} ${count.rows[0].n} rows`);
  }

  const empty = await pool.query('SELECT to_regclass($1) AS name', ['public.branches']);
  if (empty.rows[0].name) {
    const branches = await pool.query('SELECT COUNT(*)::int AS n FROM branches');
    if (branches.rows[0].n === 0) {
      console.log('Database is empty. Run: npm run db:init');
    }
  }
} catch (err) {
  const code = err.code ? `${err.code} ` : '';
  console.error(`Database check failed for ${target()}: ${code}${err.message}`);
  if (err.code === '3D000') console.error('Create it with: npm run db:init');
  if (err.code === '28P01' || err.code === '28000') {
    console.error('Fix PGUSER / PGPASSWORD in server/.env.');
  }
  if (err.code === 'ECONNREFUSED') console.error('Start the PostgreSQL service first.');
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
