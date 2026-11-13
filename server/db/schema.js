// Relational schema for the FinTech Banking analytics platform.
// Safe to run repeatedly: tables, columns and indexes are created only when missing.
import { categoryFor } from '../utils/categories.js';

const TABLES = [
  `CREATE TABLE IF NOT EXISTS branches (
    branch_id SERIAL PRIMARY KEY,
    branch_code TEXT UNIQUE NOT NULL,
    branch_name TEXT NOT NULL,
    city TEXT,
    address TEXT,
    phone TEXT,
    created_at DATE
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    branch_id INTEGER REFERENCES branches(branch_id),
    status TEXT DEFAULT 'active',
    created_at DATE
  )`,

  `CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(branch_id),
    name TEXT NOT NULL,
    age INTEGER,
    city TEXT,
    occupation TEXT,
    monthly_income NUMERIC(14,2),
    credit_score INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATE
  )`,

  `CREATE TABLE IF NOT EXISTS accounts (
    account_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    branch_id INTEGER REFERENCES branches(branch_id),
    account_type TEXT NOT NULL,
    opening_balance NUMERIC(14,2),
    current_balance NUMERIC(14,2),
    status TEXT DEFAULT 'active',
    created_at DATE
  )`,

  `CREATE TABLE IF NOT EXISTS loans (
    loan_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    branch_id INTEGER REFERENCES branches(branch_id),
    loan_type TEXT NOT NULL,
    loan_amount NUMERIC(14,2),
    interest_rate NUMERIC(6,2),
    tenure_months INTEGER,
    emi NUMERIC(14,2),
    amount_repaid NUMERIC(14,2),
    outstanding_amount NUMERIC(14,2),
    interest_earned NUMERIC(14,2),
    loan_status TEXT,
    payment_status TEXT,
    issue_date DATE,
    due_date DATE
  )`,

  `CREATE TABLE IF NOT EXISTS loan_payments (
    payment_id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(loan_id),
    customer_id INTEGER REFERENCES customers(customer_id),
    branch_id INTEGER REFERENCES branches(branch_id),
    payment_date DATE,
    emi_amount NUMERIC(14,2),
    principal_paid NUMERIC(14,2),
    interest_paid NUMERIC(14,2),
    payment_method TEXT,
    payment_status TEXT DEFAULT 'paid'
  )`,

  `CREATE TABLE IF NOT EXISTS transactions (
    transaction_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    account_id INTEGER REFERENCES accounts(account_id),
    branch_id INTEGER REFERENCES branches(branch_id),
    transaction_date DATE,
    payment_method TEXT,
    transaction_type TEXT,
    amount NUMERIC(14,2),
    merchant TEXT,
    status TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS revenue (
    revenue_id SERIAL PRIMARY KEY,
    date DATE,
    revenue_type TEXT NOT NULL,
    amount NUMERIC(14,2),
    branch_id INTEGER REFERENCES branches(branch_id)
  )`,

  `CREATE TABLE IF NOT EXISTS expenses (
    expense_id SERIAL PRIMARY KEY,
    date DATE,
    expense_type TEXT NOT NULL,
    amount NUMERIC(14,2),
    branch_id INTEGER REFERENCES branches(branch_id)
  )`,

  `CREATE TABLE IF NOT EXISTS banking_schemes (
    scheme_id SERIAL PRIMARY KEY,
    scheme_name TEXT NOT NULL,
    scheme_type TEXT NOT NULL,
    interest_rate NUMERIC(6,2),
    duration_months INTEGER,
    minimum_amount NUMERIC(14,2),
    maximum_amount NUMERIC(14,2),
    description TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS scheme_enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    scheme_id INTEGER REFERENCES banking_schemes(scheme_id),
    customer_id INTEGER REFERENCES customers(customer_id),
    branch_id INTEGER REFERENCES branches(branch_id),
    amount NUMERIC(14,2),
    start_date DATE
  )`,

  // External dataset staging. Records here are NEVER mixed with synthetic
  // transactions until their relationships have been validated.
  `CREATE TABLE IF NOT EXISTS import_batches (
    batch_id SERIAL PRIMARY KEY,
    source_file TEXT NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    total_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS import_transactions_staging (
    staging_id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES import_batches(batch_id),
    source_file TEXT NOT NULL,
    source_row INTEGER,
    source_transaction_id TEXT,
    customer_ref TEXT,
    transaction_date DATE,
    amount NUMERIC(14,2),
    transaction_type TEXT,
    payment_method TEXT,
    merchant TEXT,
    merchant_category TEXT,
    status TEXT,
    fraud_flag BOOLEAN DEFAULT FALSE,
    raw_row JSONB,
    validation_status TEXT,
    validation_message TEXT,
    imported_at TIMESTAMP DEFAULT NOW()
  )`,
];

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions (branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions (customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_method ON transactions (payment_method)`,
  `CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue (date)`,
  `CREATE INDEX IF NOT EXISTS idx_revenue_branch ON revenue (branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses (branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_loans_branch ON loans (branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_loans_status ON loans (loan_status)`,
  `CREATE INDEX IF NOT EXISTS idx_loan_payments_date ON loan_payments (payment_date)`,
  `CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments (loan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_customer ON accounts (customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_branch ON accounts (branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers (branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_enrollments_scheme ON scheme_enrollments (scheme_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_staging_batch_source_txn
     ON import_transactions_staging (source_file, source_transaction_id)
     WHERE source_transaction_id IS NOT NULL`,
];

// Columns added after the initial release. `ADD COLUMN IF NOT EXISTS` keeps
// existing data intact.
const COLUMNS = [
  ['transactions', 'fraud_flag', 'BOOLEAN NOT NULL DEFAULT FALSE'],
  ['transactions', 'merchant_category', 'TEXT'],
  ['transactions', 'reference_no', 'TEXT'],
  ['loans', 'interest_received', 'NUMERIC(14,2)'],
  ['users', 'last_login_at', 'TIMESTAMP'],
];

async function columnExists(query, table, column) {
  const rows = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
}

async function addMissingColumns(query) {
  const added = [];
  for (const [table, column, definition] of COLUMNS) {
    if (!(await columnExists(query, table, column))) {
      await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      added.push(`${table}.${column}`);
    }
  }
  return added;
}

async function backfillMerchantCategories(query) {
  const rows = await query(
    `SELECT DISTINCT merchant FROM transactions WHERE merchant_category IS NULL AND merchant IS NOT NULL`
  );
  for (const row of rows) {
    await query('UPDATE transactions SET merchant_category = $1 WHERE merchant = $2 AND merchant_category IS NULL', [
      categoryFor(row.merchant),
      row.merchant,
    ]);
  }
}

async function backfillDemoFraudFlags(query) {
  // Deterministic, clearly-labelled demonstration flags. These are NOT
  // verified fraud cases; the UI labels them as "flagged (simulated)".
  await query(
    `UPDATE transactions SET fraud_flag = TRUE
     WHERE transaction_id IN (
       SELECT transaction_id FROM transactions
       WHERE status IN ('Failed', 'Reversed') AND amount >= 100000
       ORDER BY transaction_id
       LIMIT 15
     )`
  );
}

export async function createSchema(query) {
  for (const sql of TABLES) {
    await query(sql);
  }

  const added = await addMissingColumns(query);

  // Create indexes after columns exist.
  for (const sql of INDEXES) {
    const uniqueStaging = sql.includes('uq_staging_batch_source_txn');
    if (uniqueStaging) {
      // The unique index depends on the staging table, which is created above.
      await query(sql).catch(() => {});
    } else {
      await query(sql);
    }
  }

  if (added.includes('transactions.merchant_category')) {
    await backfillMerchantCategories(query);
  }
  if (added.includes('transactions.fraud_flag')) {
    await backfillDemoFraudFlags(query);
  }

  return { addedColumns: added };
}
