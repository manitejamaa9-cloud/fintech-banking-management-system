import test from 'node:test';
import assert from 'node:assert/strict';
import { inr, inrCompact, fmtDate, pad } from '../utils/format.js';
import { resolvePeriod, parseIsoDate, addDaysIso, daysBetween, suggestBucket } from '../utils/dates.js';

test('Indian currency formatting', () => {
  assert.equal(inr(1234567), '₹12,34,567');
  assert.equal(inr(-1234567), '-₹12,34,567');
  assert.equal(inrCompact(12500000), '₹1.25 Cr');
  assert.equal(inrCompact(250000), '₹2.50 Lakh');
});

test('fmtDate normalises Date and ISO strings', () => {
  assert.equal(fmtDate('2026-03-05T10:00:00Z'), '2026-03-05');
  assert.equal(fmtDate(new Date(2026, 2, 5)), '2026-03-05');
  assert.equal(pad(4), '04');
});

test('parseIsoDate rejects impossible dates', () => {
  assert.equal(parseIsoDate('2026-02-28'), '2026-02-28');
  assert.equal(parseIsoDate('2026-02-31'), null);
  assert.equal(parseIsoDate('15/02/2026'), null);
});

test('day arithmetic is inclusive and stable', () => {
  assert.equal(addDaysIso('2026-01-31', 1), '2026-02-01');
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
});

test('relative periods resolve with inclusive boundaries', () => {
  const p = resolvePeriod({ period: '1m' });
  assert.equal(p.key, '1m');
  assert.equal(p.days, 30);
  assert.equal(daysBetween(p.from, p.to), 29);
  const prev = p.previous;
  assert.equal(daysBetween(prev.from, prev.to), 29);
  assert.equal(addDaysIso(prev.to, 1), p.from);
});

test('all supported periods resolve', () => {
  for (const key of ['1w', '1m', '3m', '6m', '1y', '2y', '3y', '4y', '5y', '6y']) {
    const p = resolvePeriod({ period: key });
    assert.ok(p.from && p.to, `period ${key} should resolve`);
    assert.ok(p.from <= p.to);
  }
});

test('legacy period keys are accepted', () => {
  assert.equal(resolvePeriod({ period: '90d' }).key, '3m');
});

test('custom range validates inputs', () => {
  const p = resolvePeriod({ period: 'custom', from: '2026-01-01', to: '2026-01-31' });
  assert.equal(p.from, '2026-01-01');
  assert.equal(p.to, '2026-01-31');
  assert.equal(p.days, 31);
  assert.throws(() => resolvePeriod({ period: 'custom', from: '2026-02-01', to: '2026-01-01' }), /before/);
  assert.throws(() => resolvePeriod({ period: 'custom', from: 'bad', to: '2026-01-01' }), /valid from/);
  assert.throws(() => resolvePeriod({ period: 'nope' }), /Invalid period/);
});

test('suggestBucket scales with period length', () => {
  assert.equal(suggestBucket(7), 'daily');
  assert.equal(suggestBucket(91), 'weekly');
  assert.equal(suggestBucket(365), 'monthly');
  assert.equal(suggestBucket(2190), 'yearly');
});
