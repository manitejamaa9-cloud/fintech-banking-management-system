import { todayStr, pad } from './format.js';

export const PERIOD_DAYS = {
  '1w': 7,
  '1m': 30,
  '3m': 91,
  '6m': 182,
  '1y': 365,
  '2y': 730,
  '3y': 1095,
  '4y': 1461,
  '5y': 1825,
  '6y': 2190,
};

export const PERIOD_LABELS = {
  '1w': 'Last 1 week',
  '1m': 'Last 1 month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last 1 year',
  '2y': 'Last 2 years',
  '3y': 'Last 3 years',
  '4y': 'Last 4 years',
  '5y': 'Last 5 years',
  '6y': 'Last 6 years',
  custom: 'Custom range',
  all: 'All time',
};

const LEGACY = { '7d': '1w', '30d': '1m', '90d': '3m', '180d': '6m', '365d': '1y' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject impossible dates such as 2026-02-31 (JS rolls them over).
  if (d.toISOString().slice(0, 10) !== value) return null;
  return value;
}

export function addDaysIso(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * Resolve a reporting period into inclusive ISO date boundaries.
 * Accepts { period, from, to }. Throws a ValidationError for bad input.
 */
export function resolvePeriod(input = {}) {
  const today = todayStr();
  let period = input.period || input.range || '1y';
  if (LEGACY[period]) period = LEGACY[period];

  if (period === 'custom') {
    const from = parseIsoDate(input.from);
    const to = parseIsoDate(input.to);
    if (!from || !to) {
      const err = new Error('Custom range requires valid from and to dates in YYYY-MM-DD format');
      err.status = 400;
      throw err;
    }
    if (from > to) {
      const err = new Error('Custom range from date must be before the to date');
      err.status = 400;
      throw err;
    }
    const days = daysBetween(from, to) + 1;
    return {
      key: 'custom',
      label: `${from} to ${to}`,
      from,
      to,
      days,
      previous: {
        from: addDaysIso(from, -days),
        to: addDaysIso(from, -1),
      },
    };
  }

  if (period === 'all') {
    return { key: 'all', label: PERIOD_LABELS.all, from: null, to: today, days: null, previous: null };
  }

  const days = PERIOD_DAYS[period];
  if (!days) {
    const err = new Error(
      `Invalid period "${period}". Use ${Object.keys(PERIOD_DAYS).join(', ')}, custom or all.`
    );
    err.status = 400;
    throw err;
  }

  const from = addDaysIso(today, -(days - 1));
  const to = today;
  return {
    key: period,
    label: PERIOD_LABELS[period],
    from,
    to,
    days,
    previous: {
      from: addDaysIso(from, -days),
      to: addDaysIso(from, -1),
    },
  };
}

export function suggestBucket(days) {
  if (days == null) return 'monthly';
  if (days <= 31) return 'daily';
  if (days <= 120) return 'weekly';
  if (days <= 1461) return 'monthly';
  return 'yearly';
}
