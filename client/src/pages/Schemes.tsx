import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { count, money, moneyCompact, plainPct } from '../lib/format';
import {
  Badge,
  Card,
  ErrorState,
  Loading,
  PageHeader,
  selectClass,
} from '../components/ui';
import { SchemeIcon } from '../components/Icons';

const TYPE_VARIANTS: Record<string, 'blue' | 'green' | 'purple' | 'amber'> = {
  Savings: 'blue',
  'Fixed Deposit': 'green',
  'Recurring Deposit': 'purple',
  'Tax Saving': 'amber',
  'Senior Citizen': 'green',
  'Women': 'purple',
  'Children': 'blue',
};

export function Schemes() {
  const { data, loading, error, reload } = useApi<any>('/schemes');
  const [type, setType] = useState('');

  const types = useMemo(
    () => [...new Set<string>((data?.schemes || []).map((s: any) => s.scheme_type))].sort(),
    [data]
  );

  const schemes = (data?.schemes || []).filter((s: any) => !type || s.scheme_type === type);
  const totals = (data?.schemes || []).reduce(
    (acc: any, s: any) => ({
      enrollments: acc.enrollments + Number(s.enrollments || 0),
      amount: acc.amount + Number(s.amountCollected || 0),
    }),
    { enrollments: 0, amount: 0 }
  );

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Banking schemes"
        subtitle="Product catalogue with actual enrolment and deposit totals from this database"
        actions={
          <select
            className={`${selectClass} w-auto py-1.5`}
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Scheme type"
          >
            <option value="">All scheme types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schemes offered</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{count(data?.schemes?.length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total enrolments</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{count(totals.enrollments)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount collected</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{money(totals.amount)}</p>
        </Card>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <Loading label="Loading scheme catalogue…" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schemes.map((scheme: any) => (
            <Link
              key={scheme.scheme_id}
              to={`/schemes/${scheme.scheme_id}`}
              className="group rounded-xl border border-slate-200 bg-white shadow-card transition hover:border-brand-200 hover:shadow-cardHover"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
                    <SchemeIcon width={18} height={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-700">{scheme.scheme_name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{scheme.scheme_type}</p>
                  </div>
                </div>
                <Badge variant={TYPE_VARIANTS[scheme.scheme_type] || 'slate'}>{plainPct(scheme.interest_rate)}</Badge>
              </div>
              <div className="p-4">
                <p className="line-clamp-2 min-h-[32px] text-xs leading-relaxed text-slate-500">{scheme.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Enrolments</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{count(scheme.enrollments)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Customers</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{count(scheme.customers)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Collected</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{moneyCompact(scheme.amountCollected)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Duration</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{scheme.duration_months} mo</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  {moneyCompact(scheme.minimum_amount)} – {moneyCompact(scheme.maximum_amount)} per enrolment
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && schemes.length === 0 ? (
        <Card>
          <p className="px-4 py-12 text-center text-sm text-slate-500">No schemes match this type.</p>
        </Card>
      ) : null}

      <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500">
        Revenue and interest figures are intentionally not attributed to schemes because the demonstration dataset does
        not link scheme deposits to those ledgers. Only actual enrolments and amounts are shown.
      </p>
    </div>
  );
}
