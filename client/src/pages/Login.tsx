import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { btnPrimary, inputClass, labelClass, Spinner } from '../components/ui';
import { CheckIcon, LockIcon } from '../components/Icons';

interface Branch {
  branch_id: number;
  branch_code: string;
  branch_name: string;
  city: string;
}

export function Login() {
  const { user, login, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState('');
  const [twoFA, setTwoFA] = useState(false);
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/auth/branches').then((res) => setBranches(res.data.branches || [])).catch(() => setBranches([]));
  }, []);

  if (initializing) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner size={28} /></div>;
  if (user) return <Navigate to={from === '/login' ? '/' : from} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!employeeId.trim() || !password) { setError('Enter your employee ID and password.'); return; }
    setSubmitting(true);
    try {
      await login({ employee_id: employeeId.trim(), password, branch_id: branchId || undefined, twoFA, otp: twoFA ? otp : undefined });
      navigate(from === '/login' ? '/' : from, { replace: true });
    } catch (err) { setError(errorMessage(err)); }
    finally { setSubmitting(false); }
  };

  const fillDemo = () => {
    setEmployeeId('SUPER001'); setPassword('Admin@123'); setTwoFA(false); setOtp(''); setError(null);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(circle at 18% 12%, rgba(31,66,245,.55), transparent 42%), radial-gradient(circle at 85% 78%, rgba(14,165,233,.28), transparent 45%)' }} />
        <div className="relative"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl font-black">₹</span><div><p className="text-base font-bold">FinTech Bank</p><p className="text-xs text-slate-400">Financial Analytics Console</p></div></div>
          <div className="mt-20 max-w-md"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Internal decision platform</p><h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight">Every branch, every rupee, in one clear view.</h1><p className="mt-4 text-sm leading-relaxed text-slate-400">Track profitability, loan health, scheme enrolment, and transaction risk with a live view of the bank&apos;s operating performance.</p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">{['Revenue, expense and net-profit reporting with period comparisons','Branch-level performance, loan portfolio and EMI collection health','Forecasts, alerts and exportable board-ready reports'].map((item)=><li key={item} className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"><CheckIcon width={13} height={13} /></span>{item}</li>)}</ul>
          </div>
        </div>
        <div className="relative rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-slate-400"><p className="font-semibold text-slate-200">Demonstration environment</p><p className="mt-1">All customers, balances and transactions are synthetic. Do not enter real personal or financial information.</p></div>
      </div>
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-1/2"><div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white">₹</span><div><p className="text-sm font-bold text-slate-900">FinTech Bank</p><p className="text-[11px] text-slate-500">Analytics Console</p></div></div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Employee sign in</h2><p className="mt-1 text-sm text-slate-500">Authorized bank personnel only. Access is logged.</p>
        <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
          <div><label className={labelClass} htmlFor="employeeId">Employee ID</label><input id="employeeId" className={inputClass} autoComplete="username" placeholder="e.g. SUPER001" value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)} autoFocus /></div>
          <div><label className={labelClass} htmlFor="password">Password</label><div className="relative"><input id="password" type={showPassword?'text':'password'} className={`${inputClass} pr-16`} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e)=>setPassword(e.target.value)} /><button type="button" className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-brand-600 hover:text-brand-700" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Hide':'Show'}</button></div></div>
          <div><label className={labelClass} htmlFor="branch">Branch access</label><select id="branch" className={inputClass} value={branchId} onChange={(e)=>setBranchId(e.target.value)}><option value="">My assigned branch</option>{branches.map((b)=><option key={b.branch_id} value={b.branch_id}>{b.branch_code} · {b.branch_name}, {b.city}</option>)}</select><p className="mt-1 text-[11px] text-slate-400">Branch managers can only sign in to their own branch.</p></div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"><label className="flex cursor-pointer items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-medium text-slate-700"><LockIcon width={16} height={16} className="text-slate-400" />Require one-time passcode</span><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={twoFA} onChange={(e)=>setTwoFA(e.target.checked)} /></label>{twoFA?<div className="mt-2"><input className={inputClass} inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,''))} /><p className="mt-1 text-[11px] text-slate-400">Demo OTP: <span className="font-mono font-semibold">123456</span></p></div>:null}</div>
          {error?<div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>:null}
          <button type="submit" className={`${btnPrimary} w-full py-2.5`} disabled={submitting}>{submitting?<><Spinner size={16}/>Signing in…</>:'Sign in securely'}</button>
        </form>
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-700">Demo account</p><p className="mt-0.5 font-mono text-[11px] text-slate-500">SUPER001 / Admin@123</p></div><button type="button" onClick={fillDemo} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">Use demo login</button></div></div>
        <p className="mt-6 text-center text-[11px] text-slate-400">For access issues, contact your branch administrator.</p>
      </div></div>
    </div>
  );
}
