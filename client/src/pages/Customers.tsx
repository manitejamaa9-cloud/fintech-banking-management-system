import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounce';
import { count, money, moneyCompact, plainPct, shortDate } from '../lib/format';
import {
  Badge,
  Card,
  ErrorState,
  KpiCard,
  Loading,
  PageHeader,
  Pagination,
  StatusBadge,
  btnSecondary,
  inputClass,
  selectClass,
} from '../components/ui';
import { SearchIcon } from '../components/Icons';

export function Customers() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [branch, setBranch] = useState('');
  const [city, setCity] = useState('');
  const [minIncome, setMinIncome] = useState('');
  const [maxIncome, setMaxIncome] = useState('');
  const [page, setPage] = useState(1);

  const branches = useApi<any>('/branches');
  const analytics = useApi<any>('/analytics/customers');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('pageSize', '20');
    if (debounced.trim()) p.set('search', debounced.trim());
    if (branch) p.set('branch', branch);
    if (city.trim()) p.set('city', city.trim());
    if (minIncome) p.set('minIncome', minIncome);
    if (maxIncome) p.set('maxIncome', maxIncome);
    return p.toString();
  }, [page, debounced, branch, city, minIncome, maxIncome]);

  const { data, loading, error, reload } = useApi<any>(`/customers?${query}`);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const reset = () => {
    setSearch('');
    setBranch('');
    setCity('');
    setMinIncome('');
    setMaxIncome('');
    setPage(1);
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Customers"
        subtitle="Customer base, account relationships and borrowing exposure"
        actions={<span className="text-xs text-slate-500">{data ? `${count(data.total)} customers` : ''}</span>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total customers" value={count(analytics.data?.total)} hint={`${count(analytics.data?.newCustomers)} new in 30 days`} />
        <KpiCard label="Active" value={count(analytics.data?.active)} hint={analytics.data ? `${plainPct(100 - analytics.data.inactiveRate)} of base` : undefined} />
        <KpiCard label="High value" value={count(analytics.data?.highValue)} hint="balance ≥ ₹10L" />
        <KpiCard label="Average balance" value={money(analytics.data?.avgBalance)} hint="per account" />
        <KpiCard label="Inactive rate" value={plainPct(analytics.data?.inactiveRate)} hint="no successful txn in 90 days" negativeIsBad />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Customer ID or name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search customers"
            />
          </div>
          <select className={selectClass} value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1); }} aria-label="Branch">
            <option value="">All branches</option>
            {(branches.data?.branches || []).map((b: any) => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.branch_name}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="City"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            aria-label="City"
          />
          <input
            type="number"
            min="0"
            className={inputClass}
            placeholder="Min monthly income"
            value={minIncome}
            onChange={(e) => {
              setMinIncome(e.target.value);
              setPage(1);
            }}
            aria-label="Minimum monthly income"
          />
          <input
            type="number"
            min="0"
            className={inputClass}
            placeholder="Max monthly income"
            value={maxIncome}
            onChange={(e) => {
              setMaxIncome(e.target.value);
              setPage(1);
            }}
            aria-label="Maximum monthly income"
          />
          <div className="lg:col-span-6 lg:text-right">
            <button type="button" className={btnSecondary} onClick={reset}>
              Reset filters
            </button>
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
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Branch</th>
                      <th className="px-4 py-3 font-semibold">Occupation</th>
                      <th className="px-4 py-3 text-right font-semibold">Monthly income</th>
                      <th className="px-4 py-3 text-right font-semibold">Balance</th>
                      <th className="px-4 py-3 text-right font-semibold">Active loans</th>
                      <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                      <th className="px-4 py-3 text-right font-semibold">Txns</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.customers || []).map((c: any) => (
                      <tr key={c.customer_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link to={`/customers/${c.customer_id}`} className="font-semibold text-brand-700 hover:underline">
                            {c.name}
                          </Link>
                          <p className="text-[11px] text-slate-400">
                            #{c.customer_id} · {c.age} yrs · {c.city}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{c.branch_name}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{c.occupation}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{moneyCompact(c.monthly_income)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{moneyCompact(c.balance)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{count(c.activeLoans)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{moneyCompact(c.outstandingLoan)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{count(c.totalTransactions)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status === 'active' ? 'Active' : c.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{shortDate(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data?.customers || []).length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">No customers match these filters.</p>
              ) : null}
              {data ? (
                <Pagination page={data.page} totalPages={totalPages} total={data.total} onChange={setPage} />
              ) : null}
            </>
          )}
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-800">Top cities</h3>
          <div className="mt-3 space-y-2">
            {(analytics.data?.cityDistribution || []).slice(0, 6).map((row: any) => {
              const max = analytics.data.cityDistribution[0]?.count || 1;
              return (
                <div key={row.city}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-600">{row.city}</span>
                    <span className="font-semibold text-slate-700">{count(row.count)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-800">Customer health</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <p className="text-[11px] text-emerald-700">Active in last 90 days</p>
              <p className="mt-0.5 text-lg font-bold text-emerald-700">{count(analytics.data?.active)}</p>
            </div>
            <div className="rounded-lg bg-red-50 px-3 py-2">
              <p className="text-[11px] text-red-700">Inactive</p>
              <p className="mt-0.5 text-lg font-bold text-red-700">{count(analytics.data?.inactive)}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <Badge variant="blue">Note</Badge>
            Active status means at least one successful transaction in the last 90 days.
          </p>
        </Card>
      </div>
    </div>
  );
}
