// Import an external banking transaction CSV into a staging table.
//
//   npm run import:csv
//   npm run import:csv -- --file "C:\path\to\indian_banking_transactions.csv"
//   npm run import:csv -- --dry-run
//
// Records are NOT inserted into the application's customers/transactions tables.
// They are validated and stored in import_transactions_staging only.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, withTransaction, closeDb, q } from '../db/index.js';
import {
  parseCsvText,
  mapHeaders,
  parseAmount,
  parseFlexibleDate,
  parseBool,
} from '../utils/csv.js';
import { categoryFor } from '../utils/categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

const dryRun = process.argv.includes('--dry-run');
const explicitFile = argValue('--file');
const candidates = explicitFile
  ? [path.resolve(process.cwd(), explicitFile)]
  : [
      path.join(projectRoot, 'data', 'indian_banking_transactions.csv'),
      path.join(projectRoot, 'data', 'fintech_banking_transactions.csv'),
    ];

function resolveFile() {
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function normaliseType(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return null;
  if (/(credit|^cr$|deposit|income|inflow)/.test(s)) return 'credit';
  if (/(debit|^dr$|withdraw|expense|outflow)/.test(s)) return 'debit';
  return s;
}

function normaliseStatus(value) {
  const s = String(value || '').trim();
  if (!s) return 'Successful';
  const found = ['Successful', 'Pending', 'Failed', 'Reversed'].find((x) => x.toLowerCase() === s.toLowerCase());
  return found || s;
}

function rowValue(row, map, key) {
  const header = map[key];
  return header ? row[header] : '';
}

function validateRows(rows, map, sourceFile) {
  const seen = new Set();
  const results = [];
  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const errors = [];

    let sourceTransactionId = String(rowValue(row, map, 'transaction_id') || '').trim();
    if (!sourceTransactionId) {
      sourceTransactionId = `ROW-${String(sourceRow).padStart(6, '0')}`;
      errors.push('missing transaction_id');
    } else if (seen.has(sourceTransactionId)) {
      errors.push('duplicate transaction_id within file');
    } else {
      seen.add(sourceTransactionId);
    }

    const date = parseFlexibleDate(rowValue(row, map, 'date'));
    if (!date) errors.push('invalid or missing date');

    const amount = parseAmount(rowValue(row, map, 'amount'));
    if (amount === null) errors.push('invalid or missing amount');
    else if (amount === 0) errors.push('amount is zero');

    const merchant = String(rowValue(row, map, 'merchant') || '').trim() || null;
    const category = String(rowValue(row, map, 'merchant_category') || '').trim() || categoryFor(merchant);

    results.push({
      sourceRow,
      sourceTransactionId,
      customerRef: String(rowValue(row, map, 'customer_ref') || '').trim() || null,
      date,
      amount,
      transactionType: normaliseType(rowValue(row, map, 'transaction_type')),
      paymentMethod: String(rowValue(row, map, 'payment_method') || '').trim() || null,
      merchant,
      merchantCategory: category,
      status: normaliseStatus(rowValue(row, map, 'status')),
      fraudFlag: parseBool(rowValue(row, map, 'fraud_flag')),
      raw: row,
      valid: errors.length === 0,
      message: errors.join('; ') || null,
      sourceFile,
    });
  });
  return results;
}

function printSummary(summary) {
  console.log('');
  console.log('================ CSV IMPORT SUMMARY ================');
  console.log(`File:        ${summary.file || '(not found)'}`);
  console.log(`Batch ID:    ${summary.batchId ?? 'n/a'}${summary.dryRun ? ' (dry run)' : ''}`);
  console.log(`Total rows:  ${summary.total}`);
  console.log(`Imported:    ${summary.imported}`);
  console.log(`Duplicates:  ${summary.duplicates}`);
  console.log(`Skipped:     ${summary.skipped} (validation errors)`);
  if (summary.errors.length) {
    console.log('Error samples:');
    summary.errors.slice(0, 15).forEach((e) => console.log(`  row ${e.row}: ${e.message}`));
    if (summary.errors.length > 15) console.log(`  ...and ${summary.errors.length - 15} more`);
  }
  console.log('====================================================');
  console.log('Records are stored in import_transactions_staging only.');
  console.log('They are never mixed into the synthetic transactions table automatically.');
  console.log('');
}

async function main() {
  const file = resolveFile();
  if (!file) {
    console.error('[import] CSV file not found. Looked for:');
    candidates.forEach((c) => console.error(`  - ${c}`));
    console.error('Place your file at data/indian_banking_transactions.csv or pass --file <path>.');
    process.exitCode = 1;
    return;
  }

  const text = fs.readFileSync(file, 'utf8');
  const sourceFile = path.basename(file);
  const parsed = parseCsvText(text);
  console.log(`[import] File: ${file}`);
  console.log(`[import] Size: ${fs.statSync(file).size} bytes`);

  if (!parsed.rows.length) {
    const message = !text.trim()
      ? 'The CSV file is empty (0 bytes or only blank lines). Nothing was imported.'
      : 'The CSV file has a header but no data rows. Nothing was imported.';
    console.warn(`[import] ${message}`);
    if (!dryRun) {
      await initDb({ seed: false });
      const batch = await q(
        `INSERT INTO import_batches (source_file, finished_at, status, notes)
         VALUES ($1, NOW(), 'empty', $2) RETURNING batch_id`,
        [sourceFile, message]
      );
      printSummary({ file, batchId: batch[0].batch_id, total: 0, imported: 0, duplicates: 0, skipped: 0, errors: [] });
      await closeDb();
    }
    return;
  }

  const { map, missing } = mapHeaders(parsed.headers);
  if (missing.length) {
    console.error(`[import] Missing required column(s): ${missing.join(', ')}`);
    console.error(`[import] Detected headers: ${parsed.headers.join(', ')}`);
    console.error('[import] See data/sample_import_template.csv for the expected format.');
    process.exitCode = 1;
    return;
  }

  const validated = validateRows(parsed.rows, map, sourceFile);
  const invalid = validated.filter((r) => !r.valid);

  if (dryRun) {
    printSummary({
      file,
      dryRun: true,
      total: validated.length,
      imported: validated.filter((r) => r.valid).length,
      duplicates: 0,
      skipped: invalid.length,
      errors: invalid.map((r) => ({ row: r.sourceRow, message: r.message })),
    });
    return;
  }

  await initDb({ seed: false });

  const summary = await withTransaction(async (run) => {
    const batchRows = await run(
      `INSERT INTO import_batches (source_file, total_rows, status, notes)
       VALUES ($1, $2, 'running', $3) RETURNING batch_id`,
      [sourceFile, validated.length, 'External dataset import into staging table']
    );
    const batchId = batchRows[0].batch_id;
    let imported = 0;
    let duplicates = 0;

    for (const r of validated) {
      const inserted = await run(
        `INSERT INTO import_transactions_staging
           (batch_id, source_file, source_row, source_transaction_id, customer_ref, transaction_date,
            amount, transaction_type, payment_method, merchant, merchant_category, status, fraud_flag,
            raw_row, validation_status, validation_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (source_file, source_transaction_id) WHERE source_transaction_id IS NOT NULL DO NOTHING
         RETURNING staging_id`,
        [
          batchId,
          sourceFile,
          r.sourceRow,
          r.sourceTransactionId,
          r.customerRef,
          r.date,
          r.amount,
          r.transactionType,
          r.paymentMethod,
          r.merchant,
          r.merchantCategory,
          r.status,
          r.fraudFlag,
          JSON.stringify(r.raw),
          r.valid ? 'valid' : 'invalid',
          r.message,
        ]
      );

      if (!inserted.length) {
        duplicates++;
      } else if (r.valid) {
        imported++;
      }
    }

    const status = invalid.length ? 'completed_with_errors' : 'completed';
    await run(
      `UPDATE import_batches SET finished_at = NOW(), imported_rows = $1, duplicate_rows = $2,
              skipped_rows = $3, error_rows = $4, status = $5 WHERE batch_id = $6`,
      [imported, duplicates, invalid.length, invalid.length, status, batchId]
    );

    return {
      file,
      batchId,
      total: validated.length,
      imported,
      duplicates,
      skipped: invalid.length,
      errors: invalid.map((r) => ({ row: r.sourceRow, message: r.message })),
    };
  });

  printSummary(summary);
}

try {
  await main();
} catch (err) {
  console.error('[import] FAILED');
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb().catch(() => {});
}
