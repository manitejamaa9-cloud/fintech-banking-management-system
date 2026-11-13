import { PERIODS, usePeriod } from '../context/PeriodContext';
import type { PeriodKey } from '../lib/period';
import { selectClass } from './ui';

export function PeriodFilter({ compact = false }: { compact?: boolean }) {
  const { period, setPeriod, customFrom, customTo, setCustom, range } = usePeriod();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact ? (
        <span className="hidden text-xs font-medium text-slate-400 xl:inline">{range.label}</span>
      ) : null}
      <select
        aria-label="Reporting period"
        className={`${selectClass} w-auto min-w-[128px] py-1.5`}
        value={period}
        onChange={(e) => setPeriod(e.target.value as PeriodKey)}
      >
        {PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </select>
      {period === 'custom' ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            aria-label="From date"
            className={`${selectClass} w-auto py-1.5`}
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustom(e.target.value, customTo)}
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            aria-label="To date"
            className={`${selectClass} w-auto py-1.5`}
            value={customTo}
            min={customFrom}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustom(customFrom, e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
