import { Link, useParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { count, money, moneyCompact, plainPct, shortDate } from '../lib/format';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  MiniStat,
  PageHeader,
  btnSecondary,
} from '../components/ui';
import { ChevronLeft, SchemeIcon } from '../components/Icons';

export function SchemeDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<any>(id ? `/schemes/${id}` : null);

  if (loading) return <Loading label="Opening scheme details…" />;
  if (error) {
    return (
      <div>
        <Link to="/schemes" className={`${btnSecondary} mb-4`}>
          <ChevronLeft width={15} height={15} /> Back to schemes
        </Link>
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (!data?.scheme) return null;

  const scheme = data.scheme;
  const enrollments = data.enrollments || [];

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={scheme.scheme_name}
        subtitle={`${scheme.scheme_type} · ${plainPct(scheme.interest_rate)} · ${scheme.duration_months} months`}
        actions={
          <Link to="/schemes" className={btnSecondary}>
            <ChevronLeft width={15} height={15} /> Back
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Scheme overview" subtitle={scheme.description} />
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <MiniStat label="Interest rate" value={plainPct(scheme.interest_rate)} />
            <MiniStat label="Duration" value={`${scheme.duration_months} months`} />
            <MiniStat label="Enrolments" value={count(scheme.enrollments)} />
            <MiniStat label="Customers" value={count(scheme.customers)} />
            <MiniStat label="Amount collected" value={money(scheme.amountCollected)} />
            <MiniStat label="Average enrolment" value={money(scheme.averageAmount)} />
            <MiniStat label="Minimum amount" value={money(scheme.minimum_amount)} />
            <MiniStat label="Maximum amount" value={money(scheme.maximum_amount)} />
            <MiniStat label="Total enrolments" value={count(scheme.enrollments)} />
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <span className="rounded-2xl bg-brand-50 p-4 text-brand-600">
            <SchemeIcon width={36} height={36} />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-800">Product performance</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{moneyCompact(scheme.amountCollected)}</p>
          <p className="mt-1 text-xs text-slate-500">
            across {count(scheme.enrollments)} enrolments from {count(scheme.customers)} customers
          </p>
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Only recorded enrolment amounts are shown. Scheme revenue is not fabricated.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Enrolments" subtitle="Latest 100 enrolments visible to your role" />
        {enrollments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Enrolment</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Start date</th>
                  <th className="px-4 py-2.5 font-semibold">Branch</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e: any) => (
                  <tr key={e.enrollment_id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">EN-{String(e.enrollment_id).padStart(5, '0')}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/customers/${e.customer_id}`} className="text-slate-700 hover:text-brand-700 hover:underline">
                        {e.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{money(e.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{shortDate(e.start_date)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">Branch #{e.branch_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No enrolments yet" message="No customers have enrolled in this scheme." />
        )}
      </Card>
    </div>
  );
}
