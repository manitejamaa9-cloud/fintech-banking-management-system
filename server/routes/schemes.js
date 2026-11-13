import { Router } from 'express';
import { q } from '../db/index.js';
import { auth, scopedBranchId } from '../middleware/auth.js';
import { num, round2, todayStr, fmtDate } from '../utils/format.js';

const router = Router();
router.use(auth);

async function schemeMetrics(user, schemeIds = null) {
  const bid = scopedBranchId(user);
  const sc = bid != null ? ' AND e.branch_id = $1' : '';
  const params = bid != null ? [Number(bid)] : [];
  let schemeSc = '';
  if (schemeIds) {
    params.push(schemeIds);
    schemeSc = ` AND e.scheme_id = $${params.length}`;
  }
  const rows = await q(
    `SELECT e.scheme_id, e.customer_id, e.amount::float AS amount, e.start_date
     FROM scheme_enrollments e WHERE 1=1${sc}${schemeSc}`,
    params
  );
  const today = todayStr();
  const byScheme = {};
  for (const r of rows) {
    const sid = r.scheme_id;
    if (!byScheme[sid]) byScheme[sid] = { customers: new Set(), amount: 0, elapsedMonths: 0, count: 0 };
    byScheme[sid].customers.add(r.customer_id);
    byScheme[sid].amount += num(r.amount);
    byScheme[sid].count++;
    const start = fmtDate(r.start_date);
    const startD = new Date(start + 'T00:00:00');
    const todayD = new Date(today + 'T00:00:00');
    const months = Math.max(0, Math.round((todayD - startD) / (30.44 * 86400000)));
    byScheme[sid].elapsedMonths += months;
  }
  return byScheme;
}

function enrichScheme(scheme, m) {
  const enrollments = m?.count || 0;
  const amountCollected = round2(m?.amount || 0);
  return {
    ...scheme,
    customers: m?.customers.size || 0,
    enrollments,
    amountCollected,
    averageAmount: enrollments ? round2(amountCollected / enrollments) : 0,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const schemes = await q('SELECT * FROM banking_schemes ORDER BY scheme_id');
    const m = await schemeMetrics(req.user);
    res.json({ schemes: schemes.map((s) => enrichScheme(s, m[s.scheme_id])) });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await q('SELECT * FROM banking_schemes WHERE scheme_id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Scheme not found' });
    const scheme = rows[0];
    const m = await schemeMetrics(req.user, id);
    const bid = scopedBranchId(req.user);
    const sc = bid != null ? ' AND e.branch_id = $1' : '';
    const params = [id];
    const enrollments = await q(
      `SELECT e.enrollment_id, e.customer_id, c.name AS customer_name, e.branch_id, e.amount::float AS amount, e.start_date
       FROM scheme_enrollments e JOIN customers c ON c.customer_id = e.customer_id
       WHERE e.scheme_id = $1${sc} ORDER BY e.start_date DESC LIMIT 100`,
      bid != null ? [id, Number(bid)] : params
    );
    res.json({ scheme: enrichScheme(scheme, m[id]), enrollments });
  } catch (e) { next(e); }
});

export default router;
