import { Link, useParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { count, money, moneyCompact, plainPct, shortDate } from '../lib/format';
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  Loading,
  MiniStat,
  PageHeader,
  ProgressBar,
  StatusBadge,
  btnSecondary,
} from '../components/ui';
import { ChevronLeft } from '../components/Icons';

export function LoanDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<any>(id ? `/loans/${id}` : null);

  if (loading) return <Loading label="Opening loan file…" />;
  if (error) {
    return (
      <div>
        <Link to="/loans" className={`${btnSecondary} mb-4`}>
          <ChevronLeft width={15} height={15} /> Back to loans
        </Link>
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (!data?.loan) return null;

  const loan = data.loan;
  const payments: any[] = data.payments || [];
  const paid = payments.filter((p) => p.payment_status === 'paid');
  const repaidPct =
    Number(loan.loan_amount) > 0 ? (Number(loan.amount_repaid) / Number(loan.loan_amount)) * 100 : null;
  const interestCollected = paid.reduce((s, p) => s + Number(p.interest_paid || 0), 0);
  const overdue = payments.filter((p) => p.payment_status === 'overdue').length;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={`Loan LN-${String(loan.loan_id).padStart(5, '0')}`}
        subtitle={`${loan.loan_type} · ${loan.customer_name} · ${loan.branch_name}`}
        actions={
          <>
            <StatusBadge status={loan.loan_status} />
            <Link to="/loans" className={btnSecondary}>
              <ChevronLeft width={15} height={15} /> Back
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Loan summary" subtitle={`Issued ${shortDate(loan.issue_date)} · due ${shortDate(loan.due_date)}`} />
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <MiniStat label="Sanctioned amount" value={money(loan.loan_amount)} />
            <MiniStat label="Amount repaid" value={money(loan.amount_repaid)} />
            <MiniStat label="Outstanding" value={money(loan.outstanding_amount)} />
            <MiniStat label="Interest rate" value={plainPct(loan.interest_rate)} />
            <MiniStat label="Tenure" value={`${loan.tenure_months} months`} />
            <MiniStat label="Monthly EMI" value={money(loan.emi)} />
            <MiniStat label="Interest earned" value={money(loan.interest_earned)} />
            <MiniStat label="Interest received" value={money(loan.interest_received)} />
            <MiniStat label="Payment status" value={loan.payment_status || '—'} />
          </div>
          <div className="px-4 pb-4">
            <ProgressBar
              value={repaidPct}
              label="Principal repaid"
              tone={loan.loan_status === 'Defaulted' || loan.loan_status === 'Overdue' ? 'red' : 'green'}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Borrower" subtitle="Customer risk snapshot" />
          <div className="space-y-3 p-4 text-sm">
            <div>
              <p className="font-semibold text-slate-800">{loan.customer_name}</p>
              <p className="text-xs text-slate-500">Customer #{loan.customer_id}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Credit score" value={loan.credit_score != null ? count(loan.credit_score) : '—'} />
              <MiniStat label="Monthly income" value={moneyCompact(loan.monthly_income)} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Occupation</p>
              <p className="mt-0.5 text-sm text-slate-700">{loan.occupation || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">EMI-to-income</p>
              <p className="mt-0.5 text-sm text-slate-700">
                {loan.monthly_income ? plainPct((Number(loan.emi) / Number(loan.monthly_income)) * 100) : '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={overdue > 0 ? 'red' : 'green'}>
                {overdue > 0 ? `${overdue} overdue installment(s)` : 'No overdue installments'}
              </Badge>
              <Badge variant="blue">{count(paid.length)} of {count(payments.length)} paid</Badge>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Repayment schedule"
          subtitle={`${count(payments.length)} installments · ${money(interestCollected)} interest collected`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">#</th>
                <th className="px-4 py-2.5 font-semibold">Payment date</th>
                <th className="px-4 py-2.5 text-right font-semibold">EMI</th>
                <th className="px-4 py-2.5 text-right font-semibold">Principal</th>
                <th className="px-4 py-2.5 text-right font-semibold">Interest</th>
                <th className="px-4 py-2.5 font-semibold">Method</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...payments].reverse().map((p, i) => (
                <tr key={p.payment_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2.5 text-slate-700">{shortDate(p.payment_date)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{money(p.emi_amount)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{money(p.principal_paid)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{money(p.interest_paid)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{p.payment_method}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.payment_status === 'paid' ? 'Paid' : p.payment_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {payments.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No repayments recorded for this loan yet.</p>
        ) : null}
      </Card>
    </div>
  );
}
