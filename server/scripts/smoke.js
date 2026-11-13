import { initDb } from '../db/index.js';

const { type, seedResult } = await initDb({ seed: true });
console.log('DB type:', type);

const r = await (await import('../db/index.js')).q('SELECT COUNT(*) c FROM customers');
console.log('customers:', r);

const q2 = await (await import('../db/index.js')).q(
  `SELECT c.name, l.loan_type, l.loan_amount::float, l.interest_earned::float, l.loan_status
   FROM loans l JOIN customers c ON c.customer_id = l.customer_id LIMIT 3`
);
console.log('sample loans:', JSON.stringify(q2));

const q3 = await (await import('../db/index.js')).q(
  `SELECT date, amount::float FROM revenue ORDER BY date DESC LIMIT 3`
);
console.log('recent revenue rows:', JSON.stringify(q3));

const q4 = await (await import('../db/index.js')).q(
  `SELECT SUM(amount::float) t FROM transactions WHERE status='Successful'`
);
console.log('transaction volume:', JSON.stringify(q4));

const q5 = await (await import('../db/index.js')).q(
  `SELECT payment_method, COUNT(*) n, SUM(amount::float) v FROM transactions GROUP BY payment_method ORDER BY v DESC`
);
console.log('payment methods:', JSON.stringify(q5));

const q6 = await (await import('../db/index.js')).q(
  `SELECT loan_status, COUNT(*) n FROM loans GROUP BY loan_status`
);
console.log('loan statuses:', JSON.stringify(q6));

const q7 = await (await import('../db/index.js')).q(
  `SELECT b.branch_name, SUM(r.amount::float) rev FROM revenue r JOIN branches b ON b.branch_id=r.branch_id GROUP BY b.branch_name`
);
console.log('revenue by branch:', JSON.stringify(q7));

const q8 = await (await import('../db/index.js')).q(
  `SELECT r.revenue_type, SUM(r.amount::float) v FROM revenue r GROUP BY r.revenue_type ORDER BY v DESC`
);
console.log('revenue by type:', JSON.stringify(q8));

process.exit(0);
