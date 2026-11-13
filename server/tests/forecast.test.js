import test from 'node:test';
import assert from 'node:assert/strict';
import { linearRegression, buildForecast } from '../utils/forecast.js';

test('linear regression recovers a known slope', () => {
  const reg = linearRegression([0, 1, 2, 3], [10, 20, 30, 40]);
  assert.equal(reg.slope, 10);
  assert.equal(reg.intercept, 10);
});

test('forecast refuses to guess with insufficient history', () => {
  const months = [
    { label: '2026-01', profit: 1000, hasData: true },
    { label: '2026-02', profit: 2000, hasData: false },
    { label: '2026-03', profit: 3000, hasData: true },
  ];
  const f = buildForecast(months);
  assert.equal(f.available, false);
  assert.match(f.reason, /Not enough historical months/);
  assert.deepEqual(f.expected, []);
});

test('forecast returns an upward trend and future labels', () => {
  const months = [
    { label: '2026-01', profit: 1000, hasData: true },
    { label: '2026-02', profit: 2000, hasData: true },
    { label: '2026-03', profit: 3000, hasData: true },
  ];
  const f = buildForecast(months, { horizonMonths: 2 });
  assert.equal(f.available, true);
  assert.equal(f.series.length, 5);
  assert.equal(f.series[3].forecast, true);
  assert.equal(f.series[3].label, '2026-04');
  assert.equal(f.series[4].profit, 5000);
  assert.ok(f.expected.length >= 3);
  assert.match(f.disclaimer, /not guaranteed/);
});
