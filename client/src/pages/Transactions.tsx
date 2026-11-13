import { useMemo, useState } from 'react';
import { usePeriod } from '../context/PeriodContext';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounce';
import { count, money, shortDate } from '../lib/format';
import {
  Badge,
  Card,
  ErrorState,
  Loading,
  PageHeader,
  Pagination,
  StatusBadge,
  btnSecondary,
  inputClass,
  selectClass,
} from '../components/ui';
import { AlertIcon, SearchIcon } from '../components/Icons';

export function Transactions() {
  const { range } = usePeriod();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [fraud, setFraud] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [inPeriod, setInPeriod] = useState(true);
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('pageSize', '25');
    p.set('sort', sort);
    if (debounced.trim()) p.set('search', debounced.trim());
    if (method) p.set('method', method);
    if (status) p.set('status', status);
    if (type) p.set('type', type);
    if (category) p.set('category', category);
    if (fraud) p.set('fraud', fraud);
    if (minAmount) p.set('minAmount', minAmount);
    if (maxAmount) p.set('maxAmount', maxAmount);
    if (inPeriod) {
      p.set('from', range.from);
      p.set('to', range.to);
    }
    return p.toString();
  }, [page, sort, debounced, method, status, type, category, fraud, minAmount, maxAmount, inPeriod, range]);

  const { data, loading, error, reload } = useApi<any>(`/transactions?${query}`);

  const update = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const reset = () => {
    setSearch('');
    setMethod('');
    setStatus('');
    setType('');
    setCategory('');
    setFraud('');
    setMinAmount('');
    setMaxAmount('');
    setSort('date_desc');
    setInPeriod(true);
    setPage(1);
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Transactions"
        subtitle="Investigate payment activity, merchant categories and simulated fraud flags"
        actions={<span className="text-xs text-slate-500">{data ? `${count(data.total)} matching transactions` : ''}</span>}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
        <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
        <p>
          Risk flags in this demonstration environment are <strong>simulated</strong> heuristics applied to synthetic
          data. They are not a fraud determination and no real customer data is present.
        </p>
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Reference, customer, merchant or ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search transactions"
            />
          </div>
          <select className={selectClass} value={method} onChange={(e) => update(setMethod)(e.target.value)} aria-label="Payment method">
            <option value="">All methods</option>
            {(data?.filters?.methods || []).map((m: string) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select className={selectClass} value={status} onChange={(e) => update(setStatus)(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {(data?.filters?.statuses || []).map((s: string) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className={selectClass} value={type} onChange={(e) => update(setType)(e.target.value)} aria-label="Debit or credit">
            <option value="">Debit & credit</option>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <select className={selectClass} value={category} onChange={(e) => update(setCategory)(e.target.value)} aria-label="Merchant category">
            <option value="">All categories</option>
            {(data?.filters?.categories || []).map((c: string) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className={selectClass} value={fraud} onChange={(e) => update(setFraud)(e.target.value)} aria-label="Risk flag">
            <option value="">All risk states</option>
            <option value="true">Flagged only</option>
            <option value="false">Not flagged</option>
          </select>
          <input
            type="number"
            min="0"
            className={inputClass}
            placeholder="Min amount"
            value={minAmount}
            onChange={(e) => {
              setMinAmount(e.target.value);
              setPage(1);
            }}
            aria-label="Minimum amount"
          />
          <input
            type="number"
            min="0"
            className={inputClass}
            placeholder="Max amount"
            value={maxAmount}
            onChange={(e) => {
              setMaxAmount(e.target.value);
              setPage(1);
            }}
            aria-label="Maximum amount"
          />
          <select className={selectClass} value={sort} onChange={(e) => update(setSort)(e.target.value)} aria-label="Sort order">
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Highest amount</option>
            <option value="amount_asc">Lowest amount</option>
          </select>
          <div className="flex items-center gap-3 lg:col-span-4">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={inPeriod}
                onChange={(e) => {
                  setInPeriod(e.target.checked);
                  setPage(1);
                }}
              />
              Limit to selected period
            </label>
            <button type="button" className={btnSecondary} onClick={reset}>
              Reset filters
            </button>
          </div>
          <div className="text-right text-xs text-slate-500 lg:col-span-1">
            {data ? `${count(data.transactions?.length)} shown` : null}
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <Card>
          {loading && !data ? (
            <Loading />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Merchant / origin</th>
                      <th className="px-4 py-3 font-semibold">Method</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.transactions || []).map((t: any) => (
                      <tr key={t.transaction_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{shortDate(t.transaction_date)}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-mono text-[11px] text-slate-600">{t.reference_no || `TXN${t.transaction_id}`}</p>
                          <p className="text-[10px] text-slate-400">#{t.transaction_id}</p>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{t.customer_name}</td>
                        <td className="px-4 py-2.5">
                          <p className="text-slate-700">{t.merchant}</p>
                          <p className="text-[11px] text-slate-400">{t.merchant_category || 'Uncategorised'}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs text-slate-600">{t.payment_method}</p>
                          <p className="text-[10px] capitalize text-slate-400">{t.transaction_type}</p>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${t.transaction_type === 'credit' ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {t.transaction_type === 'credit' ? '+' : '−'}
                          {money(t.amount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          {t.fraud_flag ? <Badge variant="red">Flagged (simulated)</Badge> : <Badge variant="slate">Clear</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data?.transactions || []).length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  No transactions match these filters. Try widening the date range or resetting filters.
                </p>
              ) : null}
              {data ? (
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
              ) : null}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
