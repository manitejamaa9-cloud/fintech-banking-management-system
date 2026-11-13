import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePeriod } from '../context/PeriodContext';
import { useApi } from '../lib/useApi';
import { CHART_COLORS, count, monthLabel, money, moneyCompact, plainPct, shortDate } from '../lib/format';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  KpiCard,
  Loading,
  PageHeader,
  ProgressBar,
  btnSecondary,
} from '../components/ui';
import { ChartFrame, ChartTooltip, axisStyle, gridStyle } from '../components/charts';
import {
  AlertIcon,
  BranchIcon,
  ChartIcon,
  LoanIcon,
  RefreshIcon,
  TxnIcon,
  UsersIcon,
} from '../components/Icons';

const SEVERITY: Record<string, { dot: string; badge: 'red' | 'amber' | 'green' }> = {
  critical: { dot: 'bg-red-500', badge: 'red' },
  warning: { dot: 'bg-amber-500', badge: 'amber' },
  success: { dot: 'bg-emerald-500', badge: 'green' },
};

function topBreakdown(obj: Record<string, number>, limit = 7) {
  const entries = Object.entries(obj || {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  if (entries.length <= limit) return entries;
  const head = entries.slice(0, limit - 1);
  const rest = entries.slice(limit - 1).reduce((s, d) => s + d.value, 0);
  return [...head, { name: 'Other', value: rest }];
}

function BreakdownPie({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <EmptyState title="No breakdown available" message="No revenue or expense records fall in this period." />;
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[170px_1fr]">
      <div style={{ width: '100%', height: 170 }}>
        <ChartFrame height={170}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={2}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ChartFrame>
      </div>
      <ul className="space-y-1.5">
        {data.map((entry, i) => (
          <li key={entry.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="shrink-0 font-semibold text-slate-800">{moneyCompact(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dashboard() {
  const { period, range } = usePeriod();
  const url = `/dashboard/overview?period=${encodeURIComponent(period)}&from=${range.from}&to=${range.to}`;
  const { data, loading, error, reload } = useApi<any>(url);
  const alerts = useApi<any>('/alerts');

  if (loading && !data) return <Loading label="Compiling bank performance…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState />;

  const trend = (data.monthlyTrend || []).map((point: any) => ({ ...point, label: monthLabel(point.label) }));
  const revenueBreakdown = topBreakdown(data.revenueBreakdown);
  const expenseBreakdown = topBreakdown(data.expenseBreakdown);
  const branches = [...(data.branchPerformance || [])].sort((a: any, b: any) => b.profit - a.profit);
  const emi = data.emi || {};
  const currentMonth = emi.currentMonth || {};

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Executive overview"
        subtitle={`${data.periodLabel}: ${shortDate(data.from)} – ${shortDate(data.to)} · ${data.days ?? '—'} days`}
        actions={
          <button type="button" className={btnSecondary} onClick={reload} disabled={loading}>
            <RefreshIcon width={15} height={15} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total revenue"
          value={money(data.revenue)}
          hint="vs prior period"
          growth={data.revenueGrowth}
          icon={<ChartIcon width={16} height={16} />}
        />
        <KpiCard
          label="Total expenses"
          value={money(data.expenses)}
          hint="vs prior period"
          growth={data.expenseGrowth}
          negativeIsBad
          icon={<TxnIcon width={16} height={16} />}
        />
        <KpiCard
          label="Net profit"
          value={money(data.netProfit)}
          hint="vs prior period"
          growth={data.profitGrowth}
          icon={<LoanIcon width={16} height={16} />}
        />
        <KpiCard
          label="Profit margin"
          value={data.profitPercent == null ? '—' : plainPct(data.profitPercent)}
          hint={data.isProfit ? 'Profitable period' : 'Loss-making period'}
          icon={<BranchIcon width={16} height={16} />}
        />
        <KpiCard
          label="Loan interest income"
          value={money(data.loanInterestIncome)}
          hint="collected in period"
          icon={<LoanIcon width={16} height={16} />}
        />
        <KpiCard
          label="Customer deposits"
          value={money(data.deposits)}
          hint={`${count(data.customers?.total)} customers`}
          icon={<UsersIcon width={16} height={16} />}
        />
        <KpiCard
          label="Outstanding loans"
          value={money(data.loans?.outstanding)}
          hint={`${count(data.loans?.total)} loans · ${count(data.loans?.issued)} new`}
          icon={<LoanIcon width={16} height={16} />}
        />
        <KpiCard
          label="Transaction volume"
          value={money(data.transactions?.volume)}
          hint={`${count(data.transactions?.successful)} of ${count(data.transactions?.count)} successful`}
          icon={<TxnIcon width={16} height={16} />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue, expenses and profit"
            subtitle={`Grouped by ${data.bucket} across the selected period`}
            action={<Badge variant={data.isProfit ? 'green' : 'red'}>{data.isProfit ? 'Profit' : 'Loss'}</Badge>}
          />
          <div className="p-4">
            {trend.length ? (
              <ChartFrame height={300}>
                <ComposedChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="label" {...axisStyle} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={62} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#1f42f5" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expenses" name="Expenses" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="profit" name="Net profit" stroke="#059669" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartFrame>
            ) : (
              <EmptyState />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Active alerts" subtitle="Derived from the last 30 days of activity" />
          <div className="p-4">
            {alerts.loading ? (
              <Loading label="Checking alerts…" />
            ) : alerts.error ? (
              <p className="text-sm text-slate-500">{alerts.error}</p>
            ) : (alerts.data?.alerts || []).length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No active alerts</p>
                <p className="mt-1 text-xs text-slate-500">All monitored thresholds are within range.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {(alerts.data.alerts as any[]).slice(0, 5).map((alert) => {
                  const sev = SEVERITY[alert.severity] || SEVERITY.warning;
                  return (
                    <li key={alert.id} className="flex gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold text-slate-800">{alert.title}</p>
                          <Badge variant={sev.badge}>{alert.value}</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{alert.message}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <a href="/alerts" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
              <AlertIcon width={13} height={13} /> View all alerts
            </a>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue mix" subtitle="Grouped by income source" />
          <div className="p-4">
            <BreakdownPie data={revenueBreakdown} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Expense mix" subtitle="Grouped by cost category" />
          <div className="p-4">
            <BreakdownPie data={expenseBreakdown} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Branch performance" subtitle="Ranked by net profit for the selected period" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="px-4 py-2.5 font-semibold">Branch</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Expenses</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Profit</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Loans</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b: any, i: number) => (
                  <tr key={b.branch_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{b.branch_name}</p>
                      <p className="text-[11px] text-slate-400">{b.city}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{moneyCompact(b.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{moneyCompact(b.expenses)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {moneyCompact(b.profit)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{b.margin == null ? '—' : plainPct(b.margin)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{count(b.loans)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Profit by branch" subtitle="Selected period" />
            <div className="p-4">
              <ChartFrame height={200}>
                <BarChart data={branches.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" {...axisStyle} tickFormatter={(v) => moneyCompact(v)} />
                  <YAxis type="category" dataKey="branch_name" width={108} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine x={0} stroke="#94a3b8" />
                  <Bar dataKey="profit" name="Net profit" radius={[0, 3, 3, 0]} maxBarSize={16}>
                    {branches.slice(0, 8).map((b: any) => (
                      <Cell key={b.branch_id} fill={b.profit >= 0 ? '#16a34a' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartFrame>
            </div>
          </Card>

          <Card>
            <CardHeader title="EMI collection" subtitle="Operational health this calendar month" />
            <div className="space-y-4 p-4">
              <ProgressBar
                value={currentMonth.rate}
                label={`Collected ${moneyCompact(currentMonth.collected)} of ${moneyCompact(emi.monthlyDue)} monthly due`}
                tone={currentMonth.rate != null && currentMonth.rate < 70 ? 'red' : 'green'}
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Payments this month</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{count(currentMonth.payments)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Active loans</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{count(emi.activeLoans)}</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Collection rate compares payments received this calendar month against the current monthly EMI due of
                active and overdue loans. A zero here can simply mean no payment date falls in this month.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500">
        {data.dataNote}
      </p>
    </div>
  );
}
