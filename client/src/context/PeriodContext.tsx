import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  PERIODS,
  resolveRange,
  rangeDays,
  suggestBucket,
  todayIso,
  addDays,
} from '../lib/period';
import type { DateRange, PeriodKey } from '../lib/period';

const STORAGE_KEY = 'fintech_period';

interface Stored {
  period: PeriodKey;
  customFrom: string;
  customTo: string;
}

interface PeriodContextValue {
  period: PeriodKey;
  customFrom: string;
  customTo: string;
  range: DateRange;
  days: number;
  bucket: string;
  label: string;
  setPeriod: (period: PeriodKey) => void;
  setCustom: (from: string, to: string) => void;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

function defaults(): Stored {
  const to = todayIso();
  return { period: '1y', customFrom: addDays(to, -29), customTo: to };
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      period: (parsed.period as PeriodKey) || '1y',
      customFrom: parsed.customFrom || defaults().customFrom,
      customTo: parsed.customTo || defaults().customTo,
    };
  } catch {
    return defaults();
  }
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Stored>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setPeriod = (period: PeriodKey) => setState((s) => ({ ...s, period }));
  const setCustom = (customFrom: string, customTo: string) => setState((s) => ({ ...s, customFrom, customTo }));

  const value = useMemo<PeriodContextValue>(() => {
    const range = resolveRange(state.period, state.customFrom, state.customTo);
    const days = rangeDays(range);
    return {
      period: state.period,
      customFrom: state.customFrom,
      customTo: state.customTo,
      range,
      days,
      bucket: suggestBucket(days),
      label: range.label,
      setPeriod,
      setCustom,
    };
  }, [state]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod must be used inside PeriodProvider');
  return ctx;
}

export { PERIODS };
