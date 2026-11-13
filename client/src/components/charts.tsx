import { cloneElement, createElement, isValidElement, useEffect, useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { money, moneyCompact } from '../lib/format';
import { CHART_COLORS } from '../lib/format';
import { selectClass } from './ui';

export const axisStyle = {
  tick: { fontSize: 11, fill: '#64748b' },
  axisLine: false,
  tickLine: false,
} as const;

export const gridStyle = {
  stroke: '#e2e8f0',
  strokeDasharray: '3 5',
  vertical: false,
} as const;

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-cardHover">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {payload.map((item: any) => (
        <div key={`${item.dataKey}-${item.name}`} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color || item.fill }} />
          <span className="text-slate-500">{item.name}:</span>
          <span className="font-semibold text-slate-800">{money(item.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

const CARTESIAN_TYPES: InteractiveChartType[] = ['bar', 'line', 'area'];
const CHART_TYPE_NAMES: Record<InteractiveChartType, string> = {
  bar: 'Bar chart', grouped: 'Grouped bar', stacked: 'Stacked bar', line: 'Line chart', area: 'Area chart',
  scatter: 'Scatter plot', bubble: 'Bubble chart', pie: 'Pie chart', donut: 'Donut chart', combo: 'Combo chart',
};
const isFiniteNumber = (value: unknown) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

function convertSeries(node: ReactNode, type: InteractiveChartType, index = { value: 0 }): ReactNode {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) return node.map((child) => convertSeries(child, type, index));
    return node;
  }
  const props = node.props as Record<string, any>;
  if (node.type === Bar || node.type === Line || node.type === Area) {
    const order = index.value++;
    if (type === 'bar' || type === 'grouped' || type === 'stacked') {
      return cloneElement(node as ReactElement<any>, {
        ...props,
        type: undefined,
        stackId: type === 'stacked' ? (props.stackId || 'selected-stack') : undefined,
        fill: props.fill || props.stroke || CHART_COLORS[order % CHART_COLORS.length],
        stroke: undefined,
      }, props.children);
    }
    if (type === 'line') return cloneElement(node as ReactElement<any>, { ...props, type: 'monotone', fill: 'none', stroke: props.stroke || props.fill || CHART_COLORS[order % CHART_COLORS.length], stackId: undefined }, props.children);
    if (type === 'area') return cloneElement(node as ReactElement<any>, { ...props, type: 'monotone', fill: props.fill || props.stroke || CHART_COLORS[order % CHART_COLORS.length], fillOpacity: 0.15, stroke: props.stroke || props.fill || CHART_COLORS[order % CHART_COLORS.length], stackId: undefined }, props.children);
    if (type === 'combo') {
      return order === 0
        ? cloneElement(node as ReactElement<any>, { ...props, type: 'monotone', fill: 'none', stroke: props.stroke || props.fill || CHART_COLORS[order % CHART_COLORS.length], stackId: undefined }, props.children)
        : cloneElement(node as ReactElement<any>, { ...props, fill: props.fill || props.stroke || CHART_COLORS[order % CHART_COLORS.length], stroke: undefined, stackId: undefined }, props.children);
    }
  }
  const children = props.children;
  return children ? cloneElement(node as ReactElement<any>, props, convertSeries(children, type, index)) : node;
}

function findChartNodes(node: ReactNode, component: any): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap((child) => findChartNodes(child, component));
  if (!isValidElement(node)) return [];
  const own = node.type === component ? [node as ReactElement<any>] : [];
  return [...own, ...findChartNodes((node.props as any).children, component)];
}

function findSingleBar(node: ReactNode): ReactElement<any> | null {
  const bars = findChartNodes(node, Bar);
  return bars.length === 1 ? bars[0] : null;
}

function switchChart(children: ReactNode, type: InteractiveChartType): ReactNode {
  if (!isValidElement(children)) return children;
  if ((children.type === BarChart && type === 'bar') ||
      (children.type === LineChart && type === 'line') ||
      (children.type === AreaChart && type === 'area') ||
      (children.type === ComposedChart && type === 'combo')) return children;
  if (children.type === PieChart) {
    if (type === 'pie' || type === 'donut') {
      const updatePie = (node: ReactNode): ReactNode => {
        if (!isValidElement(node)) return node;
        const props = node.props as Record<string, any>;
        if (node.type === Pie) return cloneElement(node as ReactElement<any>, { ...props, innerRadius: type === 'donut' ? 48 : 0 });
        return props.children ? cloneElement(node as ReactElement<any>, props, updatePie(props.children)) : node;
      };
      return cloneElement(children as ReactElement<any>, children.props as any, updatePie((children.props as any).children));
    }
    if (type === 'bar') {
      const findPie = (node: ReactNode): ReactElement<any> | null => {
        if (!isValidElement(node)) return null;
        if (node.type === Pie) return node as ReactElement<any>;
        return findPie((node.props as any).children);
      };
      const pie = findPie((children.props as any).children);
      if (!pie) return children;
      const props = pie.props as Record<string, any>;
      const data = props.data || [];
      const categoryKey = props.nameKey || 'name';
      const valueKey = props.dataKey || 'value';
      return createElement(BarChart, { data, margin: { top: 8, right: 12, left: 0, bottom: 0 } },
        createElement(CartesianGrid, { ...gridStyle }),
        createElement(XAxis as any, { dataKey: categoryKey, ...axisStyle, interval: 'preserveStartEnd' }),
        createElement(YAxis as any, { ...axisStyle, tickFormatter: moneyCompact, width: 64 }),
        createElement(Tooltip as any, { content: createElement(ChartTooltip) }),
        createElement(Bar as any, { dataKey: valueKey, name: props.name || valueKey, radius: [3, 3, 0, 0] },
          data.map((row: any, index: number) => createElement(Cell as any, { key: `${row[categoryKey]}-${index}`, fill: CHART_COLORS[index % CHART_COLORS.length] }))));
    }
    return children;
  }
  if (children.type === BarChart && (type === 'pie' || type === 'donut')) {
    const props = children.props as Record<string, any>;
    const data = props.data || [];
    const bar = findSingleBar((children.props as any).children);
    const xAxis = findChartNodes((children.props as any).children, XAxis)[0];
    const yAxis = findChartNodes((children.props as any).children, YAxis)[0];
    const categoryKey = yAxis?.props.type === 'category' ? yAxis.props.dataKey : xAxis?.props.dataKey;
    if (!bar || !categoryKey) return children;
    const valueKey = bar.props.dataKey;
    const pie = <Pie data={data} dataKey={valueKey} nameKey={categoryKey} innerRadius={type === 'donut' ? 48 : 0} outerRadius={90} paddingAngle={2}>
      {data.map((row: any, index: number) => <Cell key={`${row[categoryKey]}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
    </Pie>;
    return createElement(PieChart, null, pie, createElement(Tooltip as any, { content: createElement(ChartTooltip) }), createElement(Legend as any, { wrapperStyle: { fontSize: 11 } }));
  }
  if (type === 'scatter' || type === 'bubble') {
    const data = (children.props as any).data || [];
    const numeric = Object.keys(data[0] || {}).filter((key) => !/id$/i.test(key) && data.every((row: any) => isFiniteNumber(row[key])));
    const yKey = numeric[1] || numeric[0];
    const xKey = numeric.find((key) => key !== yKey);
    const zKey = numeric.find((key) => key !== xKey && key !== yKey);
    const points = xKey && yKey ? data.map((row: any) => ({ ...row, x: Number(row[xKey]), y: Number(row[yKey]), z: zKey ? Number(row[zKey]) : undefined })) : [];
    return createElement(ScatterChart, { margin: { top: 8, right: 12, left: 4, bottom: 4 } },
      createElement(CartesianGrid, { ...gridStyle }),
      createElement(XAxis as any, { type: 'number', dataKey: 'x', name: xKey || 'x', ...axisStyle }),
      createElement(YAxis as any, { type: 'number', dataKey: 'y', name: yKey || 'y', ...axisStyle, tickFormatter: moneyCompact }),
      type === 'bubble' ? createElement(ZAxis as any, { type: 'number', dataKey: 'z', name: zKey || 'size', range: [60, 420] }) : null,
      createElement(Tooltip as any, { content: createElement(ChartTooltip) }),
      createElement(Scatter as any, { data: points, name: `${xKey} vs ${yKey}`, fill: CHART_COLORS[0] }));
  }
  const chartType = type === 'line' ? LineChart : type === 'area' ? AreaChart : type === 'combo' ? ComposedChart : BarChart;
  const converted = convertSeries((children.props as any).children, type);
  return createElement(chartType, { ...(children.props as any) }, converted);
}

export function ChartFrame({ height = 280, children }: { height?: number; children: ReactNode }) {
  const reactId = useId();
  const chartElement = isValidElement(children) ? children : null;
  const chartType = chartElement?.type ?? null;
  const data = chartElement ? ((chartElement.props as any).data || []) as any[] : [];
  const numericKeys = data.length > 1 ? Object.keys(data[0] || {}).filter((key) => !/id$/i.test(key) && !/^branch_\d+$/i.test(key) && data.every((row) => isFiniteNumber(row[key]))) : [];
  const numericDimensions = numericKeys.length;
  const graphicalSeries = isValidElement(children) ? findChartNodes(children.props.children, Bar).length + findChartNodes(children.props.children, Line).length + findChartNodes(children.props.children, Area).length : 0;
  const stackedAvailable = chartType === BarChart && findChartNodes((chartElement?.props as any).children, Bar).length >= 2 &&
    findChartNodes((chartElement?.props as any).children, Line).length === 0 && findChartNodes((chartElement?.props as any).children, Area).length === 0 &&
    findChartNodes((chartElement?.props as any).children, Bar).every((bar) => data.every((row) => isFiniteNumber(row[bar.props.dataKey]) && Number(row[bar.props.dataKey]) >= 0));
  const barSeries = chartType === BarChart ? findSingleBar((chartElement?.props as any).children) : null;
  const categoryAxis = chartType === BarChart ? findChartNodes((chartElement?.props as any).children, YAxis).find((axis) => axis.props.type === 'category') || findChartNodes((chartElement?.props as any).children, XAxis)[0] : null;
  const pieBar = Boolean(barSeries && categoryAxis?.props.dataKey && categoryAxis.props.dataKey !== 'label' && data.length > 0 && data.every((row) => isFiniteNumber(row[barSeries.props.dataKey]) && Number(row[barSeries.props.dataKey]) >= 0));
  const categoryCharts = chartType === PieChart ? ['pie', 'donut', 'bar'] as InteractiveChartType[] : pieBar ? ['pie', 'donut'] as InteractiveChartType[] : [];
  const choices = chartType === PieChart ? categoryCharts : [...CARTESIAN_TYPES, ...(graphicalSeries >= 2 ? ['grouped' as const, 'combo' as const] : []), ...(stackedAvailable ? ['stacked' as const] : []), ...(pieBar ? categoryCharts : []), ...(numericDimensions >= 2 ? ['scatter' as const] : []), ...(numericDimensions >= 3 ? ['bubble' as const] : [])];
  const storageKey = `fintech-chart:${reactId}`;
  const initialType: InteractiveChartType = chartType === PieChart ? 'donut' : chartType === AreaChart ? 'area' : chartType === LineChart ? 'line' : chartType === ComposedChart ? 'combo' : 'bar';
  const [selected, setSelected] = useState<InteractiveChartType>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey) as InteractiveChartType | null;
      return saved && choices.includes(saved) ? saved : initialType;
    } catch { return initialType; }
  });
  useEffect(() => {
    if (!choices.includes(selected)) {
      setSelected(initialType);
      try { sessionStorage.setItem(storageKey, initialType); } catch { /* storage is optional */ }
    }
  }, [initialType, selected, storageKey, choices]);
  const active = choices.includes(selected) ? selected : choices[0];
  return (
    <div className="w-full">
      <div className="mb-2 flex justify-end">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          Chart Type
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            value={active}
            onChange={(event) => {
              const value = event.target.value as InteractiveChartType;
              setSelected(value);
              try { sessionStorage.setItem(storageKey, value); } catch { /* storage is optional */ }
            }}
            aria-label={`Chart type ${reactId}`}
          >
            {choices.map((type) => <option key={type} value={type}>{CHART_TYPE_NAMES[type]}</option>)}
          </select>
        </label>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {switchChart(children, active) as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type InteractiveChartType = 'bar' | 'grouped' | 'stacked' | 'line' | 'area' | 'scatter' | 'bubble' | 'pie' | 'donut' | 'combo';
type ChartSeries = { key: string; name?: string; color?: string; type?: 'bar' | 'line' | 'area' };

/** A reusable renderer with per-chart, session-only preferences. */
export function InteractiveChart({
  id,
  data,
  xKey,
  series,
  types,
  defaultType,
  height = 280,
  xLabel,
  horizontal = false,
  zeroLine = false,
  className = '',
}: {
  id: string;
  data: Array<Record<string, any>>;
  xKey: string;
  series: ChartSeries[];
  types: InteractiveChartType[];
  defaultType: InteractiveChartType;
  height?: number;
  xLabel?: string;
  horizontal?: boolean;
  zeroLine?: boolean;
  className?: string;
}) {
  const choices = types.filter((type) => {
    if ((type === 'pie' || type === 'donut') && (series.length !== 1 || !data.length)) return false;
    if (type === 'scatter' && (!data.length || !data.every((point) => Number.isFinite(Number(point[xKey]))))) return false;
    return true;
  });
  const safeChoices = choices.length ? choices : ['bar' as const];
  const readPreference = () => {
    try {
      const saved = sessionStorage.getItem(`fintech-chart:${id}`) as InteractiveChartType | null;
      return saved && safeChoices.includes(saved) ? saved : defaultType;
    } catch {
      return defaultType;
    }
  };
  const [selected, setSelected] = useState<InteractiveChartType>(readPreference);
  const chartType = safeChoices.includes(selected) ? selected : safeChoices[0];
  const setType = (value: InteractiveChartType) => {
    setSelected(value);
    try { sessionStorage.setItem(`fintech-chart:${id}`, value); } catch { /* session storage can be unavailable */ }
  };
  const palette = series.map((item, index) => item.color || CHART_COLORS[index % CHART_COLORS.length]);
  const moneyAxis = (value: number) => moneyCompact(value);
  const pieSeries = series[0];

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          Chart Type
          <select
            className={`${selectClass} w-auto min-w-[128px] py-1.5`}
            value={chartType}
            onChange={(event) => setType(event.target.value as InteractiveChartType)}
            aria-label={`Chart type for ${id}`}
          >
            {safeChoices.map((type) => <option key={type} value={type}>{type === 'grouped' ? 'Grouped bar' : type === 'stacked' ? 'Stacked bar' : `${type[0].toUpperCase()}${type.slice(1)} chart`}</option>)}
          </select>
        </label>
      </div>
      <ChartFrame height={height}>
        {chartType === 'pie' || chartType === 'donut' ? (
          <PieChart>
            <Pie data={data} dataKey={pieSeries.key} nameKey={xKey} innerRadius={chartType === 'donut' ? 52 : 0} outerRadius={90} paddingAngle={2}>
              {data.map((row, index) => <Cell key={`${row[xKey]}-${index}`} fill={palette[index % palette.length] || CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : chartType === 'scatter' ? (
          <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis type="number" dataKey={xKey} name={xLabel || xKey} {...axisStyle} />
            <YAxis type="number" dataKey={series[0].key} name={series[0].name || series[0].key} {...axisStyle} tickFormatter={moneyAxis} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltip />} />
            <Scatter data={data} name={series[0].name || series[0].key} fill={palette[0]} />
          </ScatterChart>
        ) : chartType === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridStyle} /><XAxis dataKey={xKey} {...axisStyle} interval="preserveStartEnd" minTickGap={24} /><YAxis {...axisStyle} tickFormatter={moneyAxis} width={64} />
            <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />{zeroLine ? <ReferenceLine y={0} stroke="#94a3b8" /> : null}
            {series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.name || item.key} stroke={palette[index]} strokeWidth={2} dot={false} connectNulls={false} />)}
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridStyle} /><XAxis dataKey={xKey} {...axisStyle} interval="preserveStartEnd" minTickGap={24} /><YAxis {...axisStyle} tickFormatter={moneyAxis} width={64} />
            <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />{zeroLine ? <ReferenceLine y={0} stroke="#94a3b8" /> : null}
            {series.map((item, index) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.name || item.key} stroke={palette[index]} fill={palette[index]} fillOpacity={0.14} connectNulls={false} />)}
          </AreaChart>
        ) : chartType === 'combo' ? (
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridStyle} /><XAxis dataKey={xKey} {...axisStyle} interval="preserveStartEnd" minTickGap={24} /><YAxis {...axisStyle} tickFormatter={moneyAxis} width={64} />
            <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />{zeroLine ? <ReferenceLine y={0} stroke="#94a3b8" /> : null}
            {series.map((item, index) => item.type === 'line' ? <Line key={item.key} type="monotone" dataKey={item.key} name={item.name || item.key} stroke={palette[index]} strokeWidth={2} dot={false} /> : <Bar key={item.key} dataKey={item.key} name={item.name || item.key} fill={palette[index]} maxBarSize={28} />)}
          </ComposedChart>
        ) : (
          <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            {horizontal ? <><XAxis type="number" {...axisStyle} tickFormatter={moneyAxis} /><YAxis type="category" dataKey={xKey} width={100} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} /></> : <><XAxis dataKey={xKey} {...axisStyle} interval="preserveStartEnd" minTickGap={20} /><YAxis {...axisStyle} tickFormatter={moneyAxis} width={64} /></>}
            <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />{zeroLine ? <ReferenceLine y={0} stroke="#94a3b8" /> : null}
            {series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.name || item.key} fill={palette[index]} stackId={chartType === 'stacked' ? 'stack' : undefined} radius={[3, 3, 0, 0]} maxBarSize={32} />)}
          </BarChart>
        )}
      </ChartFrame>
    </div>
  );
}

export function CompactAxisTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fontSize={10} fill="#64748b">
      {payload?.value}
    </text>
  );
}

export { money, moneyCompact };
