import type { ReactNode } from 'react';
import { TrendDown, TrendUp, InfoIcon } from './Icons';
import { moneyCompact, pct } from '../lib/format';

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400';

export const selectClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

export const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Loading({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-6 text-center">
      <p className="text-sm font-semibold text-red-700">Unable to load this section</p>
      <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">{message}</p>
      {onRetry ? (
        <button type="button" className={`${btnSecondary} mt-4`} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </Card>
  );
}

export function EmptyState({
  title = 'No data for this period',
  message = 'Try a different reporting period or verify that the demo database has been seeded.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        <InfoIcon width={24} height={24} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'purple';

const badgeStyles: Record<BadgeVariant, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
};

export function Badge({ children, variant = 'slate' }: { children: ReactNode; variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badgeStyles[variant]}`}
    >
      {children}
    </span>
  );
}

export function statusVariant(status?: string | null): BadgeVariant {
  const s = String(status || '').toLowerCase();
  if (['active', 'completed', 'successful', 'paid', 'current', 'posted'].includes(s)) return 'green';
  if (['overdue', 'defaulted', 'failed', 'reversed', 'inactive', 'closed'].includes(s)) return 'red';
  if (['pending', 'not due', 'partial'].includes(s)) return 'amber';
  return 'slate';
}

export function StatusBadge({ status }: { status?: string | null }) {
  return <Badge variant={statusVariant(status)}>{status || 'Unknown'}</Badge>;
}

export function KpiCard({
  label,
  value,
  hint,
  growth,
  icon,
  negativeIsBad = true,
}: {
  label: string;
  value: string;
  hint?: string;
  growth?: number | null;
  icon?: ReactNode;
  negativeIsBad?: boolean;
}) {
  const hasGrowth = growth !== null && growth !== undefined && Number.isFinite(Number(growth));
  const positive = hasGrowth && Number(growth) >= 0;
  const good = positive ? !negativeIsBad : negativeIsBad;
  return (
    <Card className="p-4 transition hover:shadow-cardHover">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="rounded-lg bg-brand-50 p-2 text-brand-600">{icon}</span> : null}
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      <div className="mt-2 flex min-h-[18px] items-center gap-2 text-xs">
        {hasGrowth ? (
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              good ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {positive ? <TrendUp width={14} height={14} /> : <TrendDown width={14} height={14} />}
            {pct(growth)}
          </span>
        ) : null}
        {hint ? <span className="text-slate-400">{hint}</span> : null}
      </div>
    </Card>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-slate-500">
        Page {page} of {Math.max(1, totalPages)} · {total.toLocaleString('en-IN')} records
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btnSecondary}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={btnSecondary}
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'brand',
}: {
  value: number | null;
  label?: string;
  tone?: 'brand' | 'green' | 'red' | 'amber';
}) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const color =
    tone === 'green' ? 'bg-emerald-500' : tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand-600';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-700">{value == null ? 'n/a' : `${v.toFixed(1)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function MoneyCell({ value }: { value: number | null | undefined }) {
  const n = Number(value ?? 0);
  return <span className={n < 0 ? 'font-semibold text-red-600' : 'text-slate-700'}>{moneyCompact(n)}</span>;
}
