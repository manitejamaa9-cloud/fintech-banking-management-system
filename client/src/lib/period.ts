export const PERIODS = [
  { key: '1w', label: '1 week', days: 7 },
  { key: '1m', label: '1 month', days: 30 },
  { key: '3m', label: '3 months', days: 91 },
  { key: '6m', label: '6 months', days: 182 },
  { key: '1y', label: '1 year', days: 365 },
  { key: '2y', label: '2 years', days: 730 },
  { key: '3y', label: '3 years', days: 1095 },
  { key: '4y', label: '4 years', days: 1461 },
  { key: '5y', label: '5 years', days: 1825 },
  { key: '6y', label: '6 years', days: 2190 },
] as const;

export type PeriodKey = (typeof PERIODS)[number]['key'] | 'custom';

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function resolveRange(period: PeriodKey, customFrom?: string, customTo?: string): DateRange {
  if (period === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo, label: `${customFrom} to ${customTo}` };
  }
  const found = PERIODS.find((p) => p.key === period) ?? PERIODS.find((p) => p.key === '1y')!;
  const to = todayIso();
  const from = addDays(to, -(found.days - 1));
  return { from, to, label: `Last ${found.label}` };
}

export function suggestBucket(days: number): string {
  if (days <= 31) return 'daily';
  if (days <= 120) return 'weekly';
  if (days <= 1461) return 'monthly';
  return 'yearly';
}

export function rangeDays(range: DateRange): number {
  const a = new Date(`${range.from}T00:00:00`).getTime();
  const b = new Date(`${range.to}T00:00:00`).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
