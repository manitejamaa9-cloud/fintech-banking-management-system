import { num, round2 } from './format.js';

export function linearRegression(xs, ys) {
  const n = xs.length;
  if (n === 0) return { n: 0, slope: 0, intercept: 0, r2: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { n, slope, intercept, r2, meanX: mx, meanY: my };
}

function addMonthsToLabel(label, offset) {
  const [ys, ms] = String(label).split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m) return label;
  const total = y * 12 + (m - 1) + offset;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/**
 * Build a transparent linear-trend forecast from monthly profit points.
 *
 * months: [{ label: 'YYYY-MM', profit: number, hasData: boolean }]
 * Returns available=false with a human-readable reason when there is not
 * enough real historical data. Values are estimates, never guaranteed results.
 */
export function buildForecast(months, { horizonMonths = 12, minPoints = 3 } = {}) {
  const observed = months
    .map((m, i) => ({ ...m, x: i, y: num(m.profit), hasData: Boolean(m.hasData) }))
    .filter((m) => m.hasData);

  if (observed.length < minPoints) {
    return {
      available: false,
      reason: `Not enough historical months with data to forecast. Found ${observed.length}; at least ${minPoints} are required.`,
      method: 'Linear least-squares trend',
      series: months.map((m) => ({ label: m.label, profit: num(m.profit), forecast: false, hasData: Boolean(m.hasData) })),
      expected: [],
    };
  }

  const xs = observed.map((m) => m.x);
  const ys = observed.map((m) => m.y);
  const reg = linearRegression(xs, ys);
  const predictAt = (x) => round2(reg.intercept + reg.slope * x);

  const lastIndex = months.length - 1;
  const lastLabel = months[lastIndex].label;
  const future = [];
  for (let i = 1; i <= horizonMonths; i++) {
    future.push({
      label: addMonthsToLabel(lastLabel, i),
      profit: predictAt(lastIndex + i),
      forecast: true,
      hasData: false,
    });
  }

  const horizons = [
    { key: '1w', label: 'Next 1 week', months: 0.25 },
    { key: '1m', label: 'Next 1 month', months: 1 },
    { key: '3m', label: 'Next 3 months', months: 3 },
    { key: '6m', label: 'Next 6 months', months: 6 },
    { key: '1y', label: 'Next 1 year', months: 12 },
  ];

  const observedAvg = ys.reduce((a, b) => a + b, 0) / ys.length;
  const expected = horizons.map((h) => {
    const monthly = predictAt(lastIndex + h.months);
    const expectedProfit = round2(monthly * h.months);
    const baseline = round2(observedAvg * h.months);
    return {
      ...h,
      expectedProfit,
      baseline,
      growthPercent: baseline > 0 ? round2(((expectedProfit - baseline) / baseline) * 100) : null,
    };
  });

  return {
    available: true,
    reason: null,
    method: 'Linear least-squares trend on up to 12 months of actual monthly net profit',
    slopePerMonth: round2(reg.slope),
    r2: round2(reg.r2 * 100) / 100,
    observedMonths: observed.length,
    series: [
      ...months.map((m) => ({ label: m.label, profit: num(m.profit), forecast: false, hasData: Boolean(m.hasData) })),
      ...future,
    ],
    expected,
    disclaimer:
      'Forecast values are statistical estimates based on historical data and are not guaranteed financial results.',
  };
}
