import test from 'node:test';
import assert from 'node:assert/strict';
import {
  netProfit,
  profitMargin,
  growthPercent,
  computeEmi,
  splitEmi,
  emiCollectionRate,
} from '../utils/finance.js';

test('net profit is revenue minus expenses', () => {
  assert.equal(netProfit(100000, 40000), 60000);
  assert.equal(netProfit(50000, 75000), -25000);
  assert.equal(netProfit(null, 1000), -1000);
});

test('profit margin handles zero revenue without dividing by zero', () => {
  assert.equal(profitMargin(1000, 400), 60);
  assert.equal(profitMargin(0, 100), null);
  assert.equal(profitMargin(-10, 100), null);
});

test('growth avoids misleading percentages from zero or negative bases', () => {
  assert.equal(growthPercent(120, 100), 20);
  assert.equal(growthPercent(80, 100), -20);
  assert.equal(growthPercent(100, 0), null);
  assert.equal(growthPercent(100, -50), null);
  assert.equal(growthPercent(100, null), null);
});

test('EMI calculation matches the reducing-balance formula', () => {
  // 10,00,000 at 9% for 120 months ~= 12,667 per month
  const emi = computeEmi(1000000, 9, 120);
  assert.ok(Math.abs(emi - 12667) < 20, `unexpected EMI ${emi}`);
  assert.equal(computeEmi(120000, 0, 12), 10000);
  assert.equal(computeEmi(100000, 9, 0), 0);
});

test('EMI split separates interest from principal recovery', () => {
  const split = splitEmi(1000000, 12, 15000);
  assert.equal(split.interest, 10000);
  assert.equal(split.principal, 5000);
  assert.equal(split.outstandingAfter, 995000);
  const final = splitEmi(1000, 12, 5000);
  assert.equal(final.principal, 1000);
  assert.equal(final.interest, 10);
  assert.equal(final.outstandingAfter, 0);
});

test('EMI collection rate handles zero due', () => {
  assert.equal(emiCollectionRate(900, 1000), 90);
  assert.equal(emiCollectionRate(0, 0), null);
});
