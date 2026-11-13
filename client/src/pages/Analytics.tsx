import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePeriod } from '../context/PeriodContext';
import { useApi } from '../lib/useApi';
import {
  CHART_COLORS,
  count,
  money,
  moneyCompact,
  monthLabel,
  plainPct,
} from '../lib/format';
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
  selectClass,
  statusVariant,
} from '../components/ui';
import { ChartFrame, ChartTooltip, axisStyle, gridStyle } from '../components/charts';

const BUCKETS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
];

const TABS = [
  { key: 'pnl', label: 'Profit & loss' },
  { key: 'mix', label: 'Revenue & expenses' },
  { key: 'loans', label: 'Loans & collections' },
  { key: 'forecast', label: 'Forecast' },
];

export function Analytics() {
  const { range, bucket: suggested } = usePeriod();
  const [bucket, setBucket] = useState(suggested);
  const [tab, setTab] = useState('pnl');

  useEffect(() => {
    setBucket(suggested);
  }, [suggested]);

  const base = `from=${range.from}&to=${range.to}&bucket=${bucket}`;
  const pnl = useApi<any>(`/analytics/pnl?${base}`);
  const revenue = useApi<any>(`/analytics/revenue-breakdown?${base}`);
  const expenses = useApi<any>(`/analytics/expense-breakdown?${base}`);
  const loans = useApi<any>('/analytics/loans');
  const loansTypes = useApi<any>('/analytics/loan-types');
  const methods = useApi<any>(`/analytics/payment-methods?from=${range.from}&to=${range.to}`);
  const forecast = useApi<any>('/analytics/forecast');

  const pnlSeries = useMemo(
    () => (pnl.data?.series || []).map((p: any) => ({ ...p, label: monthLabel(p.label) })),
    [pnl.data]
  );

  const revenueKeys = useMemo(
    () => Object.keys(revenue.data?.series?.[0] || {}).filter((k) => k !== 'label'),
    [revenue.data]
  );
  const expenseKeys = useMemo(
    () => Object.keys(expenses.data?.series?.[0] || {}).filter((k) => k !== 'label'),
    [expenses.data]
  );

  const forecastSeries = useMemo(() => {
    const series = forecast.data?.series || [];
    const boundary = series.findIndex((p: any) => p.forecast);
    return series.map((p: any, i: number) => ({
      ...p,
      label: monthLabel(p.label),
      actual: !p.forecast && p.hasData ? p.profit : null,
      projected: p.forecast ? p.profit : i === boundary - 1 ? p.profit : null,
    }));
  }, [forecast.data]);

  const revenueTotals = (revenue.data?.totals || []).filter((t: any) => t.value > 0);
  const expenseTotals = (expenses.data?.totals || []).filter((t: any) => t.value > 0);

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Financial analytics"
        subtitle={`${range.from} to ${range.to} · drill into profitability, portfolio and forecasts`}
        actions={
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Group by
            <select
              className={`${selectClass} w-auto py-1.5`}
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              aria-label="Time grouping"
            >
              {BUCKETS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pnl' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Revenue in range" value={money(pnl.data?.totalRevenue)} />
            <KpiCard label="Expenses in range" value={money(pnl.data?.totalExpenses)} />
            <KpiCard
              label="Net profit"
              value={money(pnl.data?.netProfit)}
              hint={
                pnl.data?.totalRevenue
                  ? `Margin ${plainPct((pnl.data.netProfit / pnl.data.totalRevenue) * 100)}`
                  : undefined
              }
            />
          </div>

          <Card>
            <CardHeader title="Profit & loss trend" subtitle={`Grouped ${bucket} · revenue, expenses and resulting profit`} />
            <div className="p-4">
              {pnl.loading ? (
                <Loading />
              ) : pnl.error ? (
                <ErrorState message={pnl.error} onRetry={pnl.reload} />
              ) : pnlSeries.length ? (
                <ChartFrame height={340}>
                  <AreaChart data={pnlSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1f42f5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#1f42f5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="label" {...axisStyle} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={64} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1f42f5" fill="url(#revFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f97316" fill="url(#expFill)" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" name="Net profit" stroke="#059669" strokeWidth={2} dot={false} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  </AreaChart>
                </ChartFrame>
              ) : (
                <EmptyState />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'mix' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Revenue composition" subtitle="Share of income by source in range" />
              <div className="p-4">
                {revenue.loading ? (
                  <Loading />
                ) : revenueTotals.length ? (
                  <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr]">
                    <div style={{ width: '100%', height: 160 }}>
                      <ChartFrame height={160}>
                        <PieChart>
                          <Pie data={revenueTotals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                            {revenueTotals.map((entry: any, i: number) => (
                              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ChartFrame>
                    </div>
                    <ul className="space-y-1.5">
                      {revenueTotals.map((entry: any, i: number) => (
                        <li key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-slate-600">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="truncate">{entry.name}</span>
                          </span>
                          <span className="font-semibold text-slate-800">{moneyCompact(entry.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Expense composition" subtitle="Share of costs by category in range" />
              <div className="p-4">
                {expenses.loading ? (
                  <Loading />
                ) : expenseTotals.length ? (
                  <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr]">
                    <div style={{ width: '100%', height: 160 }}>
                      <ChartFrame height={160}>
                        <PieChart>
                          <Pie data={expenseTotals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                            {expenseTotals.map((entry: any, i: number) => (
                              <Cell key={entry.name} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ChartFrame>
                    </div>
                    <ul className="space-y-1.5">
                      {expenseTotals.map((entry: any, i: number) => (
                        <li key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-slate-600">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CHART_COLORS[(i + 4) % CHART_COLORS.length] }} />
                            <span className="truncate">{entry.name}</span>
                          </span>
                          <span className="font-semibold text-slate-800">{moneyCompact(entry.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Revenue streams over time" subtitle="Stacked contribution of every income source" />
            <div className="p-4">
              {revenue.loading ? (
                <Loading />
              ) : revenue.data?.series?.length ? (
                <ChartFrame height={300}>
                  <BarChart data={revenue.data.series.map((p: any) => ({ ...p, label: monthLabel(p.label) }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="label" {...axisStyle} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={64} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {revenueKeys.map((key, i) => (
                      <Bar key={key} dataKey={key} stackId="rev" fill={CHART_COLORS[i % CHART_COLORS.length]} maxBarSize={34} />
                    ))}
                  </BarChart>
                </ChartFrame>
              ) : (
                <EmptyState />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Expense categories over time" subtitle="Stacked contribution of every cost category" />
            <div className="p-4">
              {expenses.loading ? (
                <Loading />
              ) : expenses.data?.series?.length ? (
                <ChartFrame height={300}>
                  <BarChart data={expenses.data.series.map((p: any) => ({ ...p, label: monthLabel(p.label) }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="label" {...axisStyle} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={64} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {expenseKeys.map((key, i) => (
                      <Bar key={key} dataKey={key} stackId="exp" fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} maxBarSize={34} />
                    ))}
                  </BarChart>
                </ChartFrame>
              ) : (
                <EmptyState />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'loans' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total loans" value={count(loans.data?.totals?.total)} hint={`${count(loans.data?.totals?.active)} active`} />
            <KpiCard label="Issued amount" value={money(loans.data?.totals?.issuedAmount)} />
            <KpiCard label="Outstanding" value={money(loans.data?.totals?.outstanding)} />
            <KpiCard
              label="Default rate"
              value={plainPct(loans.data?.totals?.defaultRate)}
              hint={`${count(loans.data?.totals?.defaulted)} defaulted`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Portfolio by status" subtitle="Count and disbursed amount" />
              <div className="p-4">
                {loans.loading ? (
                  <Loading />
                ) : loans.error ? (
                  <ErrorState message={loans.error} onRetry={loans.reload} />
                ) : (loans.data?.statuses || []).some((s: any) => s.count > 0) ? (
                  <ChartFrame height={260}>
                    <BarChart data={loans.data.statuses} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="name" {...axisStyle} />
                      <YAxis {...axisStyle} allowDecimals={false} width={36} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Loans" radius={[3, 3, 0, 0]} maxBarSize={46}>
                        {loans.data.statuses.map((s: any, i: number) => (
                          <Cell key={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartFrame>
                ) : (
                  <EmptyState />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Loan types" subtitle="Exposure and default behaviour" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Loans</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Outstanding</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loansTypes.data?.types || []).map((t: any) => (
                      <tr key={t.type} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{t.type}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{count(t.loans)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{moneyCompact(t.amount)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{moneyCompact(t.outstanding)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant={t.defaultRate > 8 ? 'red' : t.defaultRate > 0 ? 'amber' : 'green'}>
                            {plainPct(t.defaultRate)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Interest collected" subtitle="Paid EMI interest over the last 12 months" />
              <div className="p-4">
                {loans.loading ? (
                  <Loading />
                ) : (loans.data?.interestTrend || []).length ? (
                  <ChartFrame height={240}>
                    <BarChart
                      data={loans.data.interestTrend.map((p: any) => ({ ...p, label: monthLabel(p.label) }))}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="label" {...axisStyle} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={60} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="interest" name="Interest collected" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ChartFrame>
                ) : (
                  <EmptyState />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Payment methods" subtitle="Successful value and failure counts in range" />
              <div className="p-4">
                {methods.loading ? (
                  <Loading />
                ) : methods.error ? (
                  <ErrorState message={methods.error} onRetry={methods.reload} />
                ) : (methods.data?.methods || []).length ? (
                  <>
                    <ChartFrame height={200}>
                      <BarChart
                        data={methods.data.methods}
                        layout="vertical"
                        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" horizontal={false} />
                        <XAxis type="number" {...axisStyle} tickFormatter={(v) => moneyCompact(v)} />
                        <YAxis type="category" dataKey="method" width={86} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="value" name="Successful value" fill="#1f42f5" radius={[0, 3, 3, 0]} maxBarSize={16}>
                          {methods.data.methods.map((m: any, i: number) => (
                            <Cell key={m.method} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartFrame>
                    <div className="mt-3 space-y-1">
                      {methods.data.methods.map((m: any) => (
                        <div key={m.method} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">{m.method}</span>
                          <span className="text-slate-600">
                            {count(m.successful)} successful · <span className="text-red-600">{count(m.failed)} failed</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState />
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'forecast' ? (
        <div className="space-y-4">
          {forecast.loading ? (
            <Loading label="Building trend forecast…" />
          ) : forecast.error ? (
            <ErrorState message={forecast.error} onRetry={forecast.reload} />
          ) : forecast.data && !forecast.data.available ? (
            <Card>
              <EmptyState title="Forecast unavailable" message={forecast.data.reason || 'Not enough historical data.'} />
            </Card>
          ) : forecast.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Average monthly profit" value={money(forecast.data.currentAvgMonthly)} hint={`${count(forecast.data.observedMonths)} months observed`} />
                <KpiCard label="Trend per month" value={money(forecast.data.slopePerMonth)} hint="linear least-squares" />
                <KpiCard label="Model fit (R²)" value={forecast.data.r2 == null ? '—' : Number(forecast.data.r2).toFixed(2)} />
                <KpiCard
                  label="Next 12 months"
                  value={money(forecast.data.expected?.find((e: any) => e.key === '1y')?.expectedProfit)}
                  hint="expected profit"
                />
              </div>

              <Card>
                <CardHeader
                  title="Profit forecast"
                  subtitle="Actual monthly net profit with a 12-month linear projection"
                  action={<Badge variant="blue">Estimate</Badge>}
                />
                <div className="p-4">
                  <ChartFrame height={330}>
                    <AreaChart data={forecastSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1f42f5" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#1f42f5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="label" {...axisStyle} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis {...axisStyle} tickFormatter={(v) => moneyCompact(v)} width={64} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="actual" name="Actual profit" stroke="#1f42f5" fill="url(#fcFill)" strokeWidth={2} connectNulls={false} />
                      <Line type="monotone" dataKey="projected" name="Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                    </AreaChart>
                  </ChartFrame>
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {forecast.data.disclaimer || forecast.data.note}
                  </p>
                </div>
              </Card>

              <Card>
                <CardHeader title="Expected profit by horizon" subtitle="Compared with the historical monthly average" />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2.5 font-semibold">Horizon</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Expected profit</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Baseline</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(forecast.data.expected || []).map((row: any) => (
                        <tr key={row.key} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-slate-700">{row.label}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${row.expectedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {money(row.expectedProfit)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{money(row.baseline)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Badge variant={row.growthPercent == null ? 'slate' : row.growthPercent >= 0 ? 'green' : 'red'}>
                              {row.growthPercent == null ? '—' : plainPct(row.growthPercent)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
