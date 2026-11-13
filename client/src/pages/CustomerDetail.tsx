import { Link, useParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { count, money, moneyCompact, plainPct, shortDate } from '../lib/format';
import {
  Card,
  CardHeader,
  ErrorState,
  Loading,
  MiniStat,
  PageHeader,
  StatusBadge,
  btnSecondary,
} from '../components/ui';
import { ChevronLeft } from '../components/Icons';

export function CustomerDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<any>(id ? `/customers/${id}` : null);

  if (loading) return <Loading label="Opening customer profile…" />;
  if (error) {
    return (
      <div>
        <Link to="/customers" className={`${btnSecondary} mb-4`}>
          <ChevronLeft width={15} height={15} /> Back to customers
        </Link>
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (!data?.customer) return null;

  const { customer, accounts = [], loans = [], transactions = [], payments = [], stats = {} } = data;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={customer.name}
        subtitle={`Customer #${customer.customer_id} · ${customer.occupation} · ${customer.branch_name}, ${customer.city}`}
        actions={
          <>
            <StatusBadge status={customer.status === 'active' ? 'Active' : customer.status} />
            <Link to="/customers" className={btnSecondary}>
              <ChevronLeft width={15} height={15} /> Back
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Total deposits" value={money(stats.totalDeposits)} />
        <MiniStat label="Loans sanctioned" value={money(stats.totalLoans)} />
        <MiniStat label="Loan outstanding" value={money(stats.outstandingLoans)} />
        <MiniStat label="Interest paid" value={money(stats.totalInterestPaid)} />
        <MiniStat label="Txn volume (last 50)" value={money(stats.totalTransactionVolume)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Profile" subtitle={`Customer since ${shortDate(customer.created_at)}`} />
          <div className="grid grid-cols-2 gap-2 p-4">
            <MiniStat label="Age" value={`${customer.age} years`} />
            <MiniStat label="Credit score" value={count(customer.credit_score)} />
            <MiniStat label="Monthly income" value={money(customer.monthly_income)} />
            <MiniStat label="City" value={customer.city} />
            <MiniStat label="Branch" value={customer.branch_name} />
            <MiniStat label="Accounts" value={count(accounts.length)} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Accounts" subtitle={`${count(accounts.length)} account(s) on file`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Account</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Opening</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Current balance</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a: any) => (
                  <tr key={a.account_id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">AC-{String(a.account_id).padStart(6, '0')}</td>
                    <td className="px-4 py-2.5 text-slate-700">{a.account_type}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{moneyCompact(a.opening_balance)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{money(a.current_balance)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={a.status === 'active' ? 'Active' : 'Closed'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {accounts.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No accounts.</p> : null}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Loans" subtitle={`${count(loans.length)} loan(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Loan</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-2.5 text-right font-semibold">EMI</th>
                <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Issued</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l: any) => (
                <tr key={l.loan_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-2.5">
                    <Link to={`/loans/${l.loan_id}`} className="font-semibold text-brand-700 hover:underline">
                      LN-{String(l.loan_id).padStart(5, '0')}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{l.loan_type}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{moneyCompact(l.loan_amount)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{moneyCompact(l.outstanding_amount)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{money(l.emi)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{plainPct(l.interest_rate)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={l.loan_status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{shortDate(l.issue_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loans.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No loans on file.</p> : null}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent transactions" subtitle="Latest 50 transactions" />
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Merchant</th>
                  <th className="px-4 py-2.5 font-semibold">Method</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t: any) => (
                  <tr key={t.transaction_id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-xs text-slate-500">{shortDate(t.transaction_date)}</td>
                    <td className="px-4 py-2">
                      <p className="text-slate-700">{t.merchant}</p>
                      <p className="text-[10px] capitalize text-slate-400">{t.transaction_type}</p>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{t.payment_method}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${t.transaction_type === 'credit' ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {money(t.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Loan payments" subtitle="Latest 20 EMI payments" />
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Loan</th>
                  <th className="px-4 py-2.5 text-right font-semibold">EMI</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Interest</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.payment_id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-xs text-slate-500">{shortDate(p.payment_date)}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">LN-{String(p.loan_id).padStart(5, '0')}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{money(p.emi_amount)}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{money(p.interest_paid)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={p.payment_status === 'paid' ? 'Paid' : p.payment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
