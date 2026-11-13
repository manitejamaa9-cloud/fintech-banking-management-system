import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePeriod } from '../context/PeriodContext';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounce';
import { count, money, moneyCompact, plainPct, shortDate } from '../lib/format';
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
import { SearchIcon } from '../components/Icons';

export function Loans() {
  const { range } = usePeriod();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [sort, setSort] = useState('id_desc');
  const [page, setPage] = useState(1);
  const [inPeriod, setInPeriod] = useState(false);

  const branches = useApi<any>('/branches');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('pageSize', '20');
    p.set('sort', sort);
    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim());
    if (type) p.set('type', type);
    if (status) p.set('status', status);
    if (branch) p.set('branch', branch);
    if (inPeriod) {
      p.set('from', range.from);
      p.set('to', range.to);
    }
    return p.toString();
  }, [page, sort, debouncedSearch, type, status, branch, inPeriod, range]);

  const { data, loading, error, reload } = useApi<any>(`/loans?${query}`);

  const update = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const reset = () => {
    setSearch('');
    setType('');
    setStatus('');
    setBranch('');
    setSort('id_desc');
    setInPeriod(false);
    setPage(1);
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Loan portfolio"
        subtitle="Search and inspect loan accounts, repayment health and customer exposure"
        actions={
          <span className="text-xs text-slate-500">
            {data ? `${count(data.total)} loans match` : 'Loading portfolio…'}
          </span>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <SearchIcon width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Loan ID or customer name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search loans"
            />
          </div>
          <select className={selectClass} value={type} onChange={(e) => update(setType)(e.target.value)} aria-label="Loan type">
            <option value="">All types</option>
            {(data?.filters?.types || []).map((t: string) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select className={selectClass} value={status} onChange={(e) => update(setStatus)(e.target.value)} aria-label="Loan status">
            <option value="">All statuses</option>
            {(data?.filters?.statuses || ['Active', 'Completed', 'Overdue', 'Defaulted', 'Pending']).map((s: string) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className={selectClass} value={branch} onChange={(e) => update(setBranch)(e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {(branches.data?.branches || []).map((b: any) => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.branch_name}
              </option>
            ))}
          </select>
          <select className={selectClass} value={sort} onChange={(e) => update(setSort)(e.target.value)} aria-label="Sort order">
            <option value="id_desc">Newest first</option>
            <option value="amount_desc">Largest amount</option>
            <option value="outstanding_desc">Highest outstanding</option>
            <option value="issue_desc">Issue date</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-600 lg:col-span-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={inPeriod}
              onChange={(e) => {
                setInPeriod(e.target.checked);
                setPage(1);
              }}
            />
            Only loans issued in the selected period
          </label>
          <div className="lg:col-span-3 lg:text-right">
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
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Loan</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Branch</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                      <th className="px-4 py-3 text-right font-semibold">Rate</th>
                      <th className="px-4 py-3 text-right font-semibold">EMI</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Issued</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.loans || []).map((loan: any) => {
                      const repaid = loan.loan_amount ? (Number(loan.amount_repaid) / Number(loan.loan_amount)) * 100 : null;
                      return (
                        <tr key={loan.loan_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <Link to={`/loans/${loan.loan_id}`} className="font-semibold text-brand-700 hover:underline">
                              LN-{String(loan.loan_id).padStart(5, '0')}
                            </Link>
                            <p className="text-[11px] text-slate-400">{loan.tenure_months} months</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{loan.customer_name}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{loan.branch_name}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{loan.loan_type}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{moneyCompact(loan.loan_amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-slate-700">{moneyCompact(loan.outstanding_amount)}</p>
                            {repaid != null ? (
                              <p className="text-[10px] text-slate-400">{plainPct(repaid, 0)} repaid</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{plainPct(loan.interest_rate)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{money(loan.emi)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={loan.loan_status} />
                              {String(loan.payment_status).toLowerCase() === 'overdue' ? (
                                <Badge variant="red">EMI overdue</Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{shortDate(loan.issue_date)}</td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/loans/${loan.loan_id}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(data?.loans || []).length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">No loans match these filters.</p>
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
