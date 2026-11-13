import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvText,
  mapHeaders,
  parseAmount,
  parseFlexibleDate,
  parseBool,
} from '../utils/csv.js';

test('CSV parser handles BOM, quotes and embedded commas', () => {
  const text = '\uFEFFid,amount,merchant\r\n1,100,"Amazon, India"\r\n2,200,"He said ""hi"""\r\n';
  const { headers, rows } = parseCsvText(text);
  assert.deepEqual(headers, ['id', 'amount', 'merchant']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].merchant, 'Amazon, India');
  assert.equal(rows[1].merchant, 'He said "hi"');
});

test('CSV parser returns empty structure for blank input', () => {
  assert.deepEqual(parseCsvText(''), { headers: [], rows: [] });
  assert.deepEqual(parseCsvText('  \r\n'), { headers: [], rows: [] });
});

test('header mapping accepts common aliases', () => {
  const { map, missing } = mapHeaders(['Txn ID', 'Date', 'Amount', 'Customer ID', 'Channel', 'Category']);
  assert.deepEqual(missing, []);
  assert.equal(map.transaction_id, 'Txn ID');
  assert.equal(map.payment_method, 'Channel');
  assert.equal(map.customer_ref, 'Customer ID');
});

test('header mapping reports required columns', () => {
  const { missing } = mapHeaders(['foo', 'bar']);
  assert.deepEqual(missing, ['transaction_id', 'date', 'amount']);
});

test('amount parsing handles Indian formatting', () => {
  assert.equal(parseAmount('1,25,000.50'), 125000.5);
  assert.equal(parseAmount('₹2,500'), 2500);
  assert.equal(parseAmount('(1,200)'), -1200);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
});

test('flexible date parsing', () => {
  assert.equal(parseFlexibleDate('2026-01-15'), '2026-01-15');
  assert.equal(parseFlexibleDate('15/01/2026'), '2026-01-15');
  assert.equal(parseFlexibleDate('15-01-2026'), '2026-01-15');
  assert.equal(parseFlexibleDate('2026-02-31'), null);
  assert.equal(parseFlexibleDate('not-a-date'), null);
});

test('boolean parsing', () => {
  assert.equal(parseBool('true'), true);
  assert.equal(parseBool('Yes'), true);
  assert.equal(parseBool('0'), false);
  assert.equal(parseBool(''), false);
});
