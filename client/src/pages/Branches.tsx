import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { usePeriod } from '../context/PeriodContext';
import { useApi } from '../lib/useApi';
import { CHART_COLORS, count, money, moneyCompact, monthLabel, plainPct } from '../lib/format';
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  KpiCard,
  Loading,
  PageHeader,
} from '../components/ui';
import { ChartFrame, ChartTooltip, axisStyle, gridStyle } from '../components/charts';
import { BranchIcon, LoanIcon } from '../components/Icons';

export function Branches() {
  const { period, range } = usePeriod();
  const analytics = useApi<any>(
    `/branches/analytics?period=${encodeURIComponent(period)}&from=${range.from}&to=${range.to}`
  );
  const directory = useApi<any>('/branches');

  const branches = analytics.data?.branches || [];
  const ranking = analytics.data?.ranking || [];

  const totals = useMemo(
    () =>
      branches.reduce(
        (acc: any, b: any) => ({
          revenue: acc.revenue + Number(b.revenue || 0),
          expenses: acc.expenses + Number(b.expenses || 0),
          profit: acc.profit + Number(b.profit || 0),
          deposits: acc.deposits + Number(b.deposits || 0),
          outstanding: acc.outstanding + Number(b.outstanding || 0),
          customers: acc.customers + Number(b.customers || 0),
        }),
        { revenue: 0, expenses: 0, profit: 0, deposits: 0, outstanding: 0, customers: 0 }
      ),
    [branches]
  );

  const series = useMemo(
    () =>
      (analytics.data?.series || []).map((point: any) => {
        const next: any = { ...point, label: monthLabel(point.label) };
        return next;
      }),
    [analytics.data]
  );

  if (analytics.loading && !analytics.data) return <Loading label="Comparing branch performance…" />;
  if (analytics.error) return <ErrorState message={analytics.error} onRetry={analytics.reload} />;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Branch performance"
        subtitle={`${analytics.data?.from || range.from} to ${analytics.data?.to || range.to} · profitability, deposits and portfolio by branch`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Branches" value={count(branches.length)} icon={<BranchIcon width={16} height={16} />} />
        <KpiCard label="Revenue" value={money(totals.revenue)} />
        <KpiCard label="Net profit" value={money(totals.profit)} />
        <KpiCard label="Deposits" value={money(totals.deposits)} />
        <KpiCard label="Loan outstanding" value={money(totals.outstanding)} icon={<LoanIcon width={16} height={16} />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Profit by branch" subtitle="Selected reporting period" />
          <div className="p-4">
            <ChartFrame height={300}>
              <BarChart data={[...branches].sort((a: any, b: any) => b.profit - a.profit)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="branch_code" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={62} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="profit" name="Net profit" radius={[3, 3, 0, 0]} maxBarSize={42}>
                  {[...branches]
                    .sort((a: any, b: any) => b.profit - a.profit)
                    .map((b: any) => (
                      <Cell key={b.branch_id} fill={b.profit >= 0 ? '#16a34a' : '#dc2626'} />
                    ))}
                </Bar>
              </BarChart>
            </ChartFrame>
          </div>
        </Card>

        <Card>
          <CardHeader title="Profit trend by branch" subtitle="Monthly net profit per branch" />
          <div className="p-4">
            {series.length ? (
              <ChartFrame height={300}>
                <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="label" {...axisStyle} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={62} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  {branches.map((b: any, i: number) => (
                    <Line
                      key={b.branch_id}
                      type="monotone"
                      dataKey={`branch_${b.branch_id}`}
                      name={b.branch_code}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={1.8}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ChartFrame>
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">No monthly series for this period.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Branch league table" subtitle="Ranked by net profit, with operating and credit metrics" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">Expenses</th>
                <th className="px-4 py-3 text-right font-semibold">Profit</th>
                <th className="px-4 py-3 text-right font-semibold">Margin</th>
                <th className="px-4 py-3 text-right font-semibold">Deposits</th>
                <th className="px-4 py-3 text-right font-semibold">Loans</th>
                <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-3 text-right font-semibold">Default rate</th>
                <th className="px-4 py-3 text-right font-semibold">Customers</th>
                <th className="px-4 py-3 text-right font-semibold">Txns</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((b: any, i: number) => (
                <tr key={b.branch_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{b.branch_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {b.branch_code} · {b.city}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{moneyCompact(b.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{moneyCompact(b.expenses)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {moneyCompact(b.profit)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{b.margin == null ? '—' : plainPct(b.margin)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{moneyCompact(b.deposits)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{count(b.loans)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{moneyCompact(b.outstanding)}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={b.defaultRate > 8 ? 'red' : b.defaultRate > 3 ? 'amber' : 'green'}>
                      {plainPct(b.defaultRate)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{count(b.customers)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{count(b.transactions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(directory.data?.branches || []).map((b: any) => {
          const stats = branches.find((x: any) => x.branch_id === b.branch_id);
          return (
            <Card key={b.branch_id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{b.branch_name}</p>
                  <p className="text-[11px] text-slate-400">{b.branch_code} · {b.city}</p>
                </div>
                {stats ? (
                  <Badge variant={stats.profit >= 0 ? 'green' : 'red'}>{moneyCompact(stats.profit)}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{b.address}</p>
              <p className="mt-1 text-[11px] text-slate-400">{b.phone}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
