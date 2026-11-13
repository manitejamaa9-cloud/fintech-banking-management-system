// CLI: seed the demo database.
//   node scripts/seed-cli.js          # seed only when empty
//   node scripts/seed-cli.js --force  # delete demo rows and reseed
import { initDb, closeDb } from '../db/index.js';

const force = process.argv.includes('--force');

try {
  const { type, seedResult } = await initDb({ seed: true, force });
  console.log(`[seed-cli] db type = ${type}`);
  if (seedResult.seeded) {
    console.log(`[seed-cli] seeded ${JSON.stringify(seedResult.counts)}`);
  } else {
    console.log(`[seed-cli] not seeded: ${seedResult.reason}. Use --force to reseed.`);
  }
} catch (err) {
  console.error('[seed-cli] FAILED');
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
