import { useState } from 'react';
import { usePeriod } from '../context/PeriodContext';
import { api, errorMessage } from '../lib/api';
import { PageHeader, Card, btnSecondary, Badge, Spinner } from '../components/ui';
import { DownloadIcon, InfoIcon, PrintIcon, ReportIcon } from '../components/Icons';

const REPORTS = [
  {
    key: 'profitloss',
    title: 'Profit & loss',
    description: 'Revenue, expenses, net profit, branch contribution and monthly series.',
    tag: 'Board',
  },
  {
    key: 'monthly',
    title: 'Monthly financial report',
    description: 'Monthly revenue, expense and profit performance for the selected range.',
    tag: 'Finance',
  },
  {
    key: 'quarterly',
    title: 'Quarterly financial report',
    description: 'Quarter-wise operating results and expense composition.',
    tag: 'Finance',
  },
  {
    key: 'annual',
    title: 'Annual financial report',
    description: 'Year-wise summary of income, costs and profitability.',
    tag: 'Board',
  },
  {
    key: 'loan',
    title: 'Loan portfolio',
    description: 'Portfolio by status, type, outstanding balances and default exposure.',
    tag: 'Credit',
  },
  {
    key: 'emi',
    title: 'EMI collection',
    description: 'Collections, interest income, overdue instalments and payment methods.',
    tag: 'Credit',
  },
  {
    key: 'transaction',
    title: 'Transaction summary',
    description: 'Transaction volume, success rate, fraud flags and payment channel mix.',
    tag: 'Operations',
  },
  {
    key: 'branch',
    title: 'Branch performance',
    description: 'Revenue, expenses, profit, deposits and loans for every branch.',
    tag: 'Operations',
  },
  {
    key: 'schemes',
    title: 'Banking schemes',
    description: 'Enrolments and amounts collected by scheme, based on recorded data.',
    tag: 'Products',
  },
];

export function Reports() {
  const { period, range } = usePeriod();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = () => {
    const p = new URLSearchParams();
    p.set('period', period);
    p.set('from', range.from);
    p.set('to', range.to);
    return p;
  };

  const download = async (type: string, format: 'csv' | 'pdf') => {
    const key = `${type}-${format}`;
    setWorking(key);
    setError(null);
    try {
      const p = params();
      p.set('type', type);
      p.set('format', format);
      const res = await api.get(`/reports?${p.toString()}`, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-report.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(null);
    }
  };

  const print = async (type: string) => {
    const key = `${type}-print`;
    setWorking(key);
    setError(null);
    const win = window.open('', '_blank');
    if (!win) {
      setError('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      setWorking(null);
      return;
    }
    win.document.write('<p style="font-family:Segoe UI,Arial;color:#64748b;padding:24px">Preparing report…</p>');
    try {
      const p = params();
      p.set('type', type);
      p.set('format', 'print');
      const res = await api.get(`/reports?${p.toString()}`, { responseType: 'text' });
      win.document.open();
      win.document.write(res.data);
      win.document.close();
      win.focus();
    } catch (err) {
      win.close();
      setError(errorMessage(err));
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Reports"
        subtitle="Generate scoped CSV or PDF downloads, or open a print-ready view"
        actions={
          <Badge variant="blue">
            Period: {range.from} → {range.to}
          </Badge>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-[11px] text-brand-800">
        <InfoIcon width={14} height={14} className="mt-0.5 shrink-0" />
        <p>
          Every export uses the reporting period selected in the top bar. Results are automatically limited to the
          branches your role is allowed to see. CSV files include a UTF-8 marker for spreadsheet compatibility.
        </p>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.key} className="flex flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
                <ReportIcon width={18} height={18} />
              </span>
              <Badge variant="slate">{report.tag}</Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-800">{report.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{report.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => download(report.key, 'csv')}
                disabled={working !== null}
              >
                {working === `${report.key}-csv` ? <Spinner size={13} /> : <DownloadIcon width={14} height={14} />}
                CSV
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => download(report.key, 'pdf')}
                disabled={working !== null}
              >
                {working === `${report.key}-pdf` ? <Spinner size={13} /> : <DownloadIcon width={14} height={14} />}
                PDF
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => print(report.key)}
                disabled={working !== null}
              >
                {working === `${report.key}-print` ? <Spinner size={13} /> : <PrintIcon width={14} height={14} />}
                Print
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">About these reports</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Reports are generated from the same PostgreSQL records that power the dashboards. There are no estimated or
          fabricated values: scheme revenue is excluded because the dataset does not link scheme deposits to a revenue
          ledger, and transaction risk flags are simulated demo fields. Printed reports open in a new tab and trigger
          the browser print dialog automatically.
        </p>
      </div>
    </div>
  );
}
