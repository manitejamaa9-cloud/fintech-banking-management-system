import { useApi } from '../lib/useApi';
import { Badge, Card, ErrorState, Loading, PageHeader, btnSecondary } from '../components/ui';
import { AlertIcon, CheckIcon, InfoIcon, RefreshIcon } from '../components/Icons';

const STYLES: Record<string, { border: string; bg: string; icon: string; badge: 'red' | 'amber' | 'green' }> = {
  critical: { border: 'border-red-200', bg: 'bg-red-50', icon: 'text-red-600', badge: 'red' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', icon: 'text-amber-600', badge: 'amber' },
  success: { border: 'border-emerald-200', bg: 'bg-emerald-50', icon: 'text-emerald-600', badge: 'green' },
};

export function Alerts() {
  const { data, loading, error, reload } = useApi<any>('/alerts');
  const alerts: any[] = data?.alerts || [];
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warnings = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Alerts"
        subtitle="Automated thresholds based on the last 30 days of activity, scoped to your role"
        actions={
          <button type="button" className={btnSecondary} onClick={reload} disabled={loading}>
            <RefreshIcon width={15} height={15} /> Re-evaluate
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open alerts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{alerts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critical</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{critical}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warnings</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{warnings}</p>
        </Card>
      </div>

      {loading ? (
        <Loading label="Evaluating thresholds…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : alerts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="rounded-full bg-emerald-50 p-4 text-emerald-600">
            <CheckIcon width={30} height={30} />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-800">Everything is within range</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            No alert thresholds were crossed in the last 30 days. Thresholds include default rate, expense growth,
            transaction volume change and UPI failure rate.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const style = STYLES[alert.severity] || STYLES.warning;
            return (
              <Card key={alert.id} className={`border ${style.border}`}>
                <div className={`flex items-start gap-3 p-4 ${style.bg} rounded-t-xl`}>
                  <span className={`mt-0.5 ${style.icon}`}>
                    {alert.severity === 'success' ? <CheckIcon width={20} height={20} /> : <AlertIcon width={20} height={20} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={style.badge}>{alert.metric}</Badge>
                        <Badge variant={style.badge}>{alert.value}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{alert.message}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">
        <InfoIcon width={14} height={14} className="mt-0.5 shrink-0" />
        <p>
          Alerts are rule-based indicators generated from the local demonstration database. They are not regulatory
          findings or live risk decisions.
        </p>
      </div>
    </div>
  );
}
