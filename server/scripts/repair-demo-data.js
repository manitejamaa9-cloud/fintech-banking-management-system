// One-off, idempotent repair for the synthetic demo dataset.
//
// An earlier seed version inflated "Interest Paid (Depositors)" to roughly
// half of total deposits per month, which made every reporting period show a
// huge artificial loss. This recalculates those synthetic expense rows from
// the other expenses recorded for the same branch and month (12% weight).
//
// It only updates rows of that one expense type. No rows are deleted and no
// real/customer data is modified.
import { initDb, q, closeDb, withTransaction } from '../db/index.js';
import { round2 } from '../utils/format.js';

try {
  await initDb({ seed: false });

  const before = await q(
    `SELECT COALESCE(SUM(amount::float),0) AS total, COUNT(*)::int AS rows
     FROM expenses WHERE expense_type = 'Interest Paid (Depositors)'`
  );

  const updated = await withTransaction(async (run) => {
    const rows = await run(
      `WITH other AS (
         SELECT branch_id, date, SUM(amount) AS other_total
         FROM expenses
         WHERE expense_type <> 'Interest Paid (Depositors)'
         GROUP BY branch_id, date
       )
       UPDATE expenses e
       SET amount = ROUND((other.other_total * 0.12 / 0.88)::numeric, 2)
       FROM other
       WHERE e.expense_type = 'Interest Paid (Depositors)'
         AND e.branch_id = other.branch_id
         AND e.date = other.date
         AND other.other_total > 0
       RETURNING e.expense_id`
    );
    return rows.length;
  });

  const after = await q(
    `SELECT COALESCE(SUM(amount::float),0) AS total, COUNT(*)::int AS rows
     FROM expenses WHERE expense_type = 'Interest Paid (Depositors)'`
  );

  console.log(`[repair] Depositor-interest rows updated: ${updated}`);
  console.log(`[repair] Total before: INR ${round2(before[0].total).toLocaleString('en-IN')}`);
  console.log(`[repair] Total after:  INR ${round2(after[0].total).toLocaleString('en-IN')}`);
} catch (err) {
  console.error('[repair] FAILED');
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
