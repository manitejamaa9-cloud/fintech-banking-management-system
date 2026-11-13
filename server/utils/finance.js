import { num, round2 } from './format.js';

export function netProfit(revenue, expenses) {
  return round2(num(revenue) - num(expenses));
}

/**
 * Profit margin percentage. Returns null when revenue is zero or negative so
 * callers can display "n/a" instead of an infinite/meaningless number.
 */
export function profitMargin(revenue, expenses) {
  const r = num(revenue);
  if (r <= 0) return null;
  return round2((netProfit(r, expenses) / r) * 100);
}

/**
 * Percentage growth vs the previous period. Returns null when the previous
 * value is missing or non-positive, because a percentage change from zero or a
 * negative base is misleading.
 */
export function growthPercent(current, previous) {
  const p = num(previous);
  const c = num(current);
  if (!previous) return null;
  if (p <= 0) return null;
  return round2(((c - p) / p) * 100);
}

export function computeEmi(principal, annualRatePercent, months) {
  const p = num(principal);
  const n = num(months);
  if (n <= 0) return 0;
  const r = num(annualRatePercent) / 100 / 12;
  if (r === 0) return round2(p / n);
  const factor = Math.pow(1 + r, n);
  return round2((p * r * factor) / (factor - 1));
}

/**
 * Split one EMI payment into interest and principal components.
 * Principal repayment is recovery of principal, not bank profit.
 */
export function splitEmi(outstanding, annualRatePercent, emi) {
  const o = num(outstanding);
  const interest = round2(o * (num(annualRatePercent) / 100 / 12));
  let principal = round2(num(emi) - interest);
  if (principal > o) principal = o;
  if (principal < 0) principal = 0;
  return { interest, principal, outstandingAfter: round2(o - principal) };
}

export function emiCollectionRate(collected, expected) {
  const e = num(expected);
  if (e <= 0) return null;
  return round2((num(collected) / e) * 100);
}
