import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PeriodFilter } from './PeriodFilter';
import {
  AlertIcon,
  BranchIcon,
  ChartIcon,
  CloseIcon,
  DashboardIcon,
  LoanIcon,
  LogoutIcon,
  MenuIcon,
  ReportIcon,
  SchemeIcon,
  SettingsIcon,
  TxnIcon,
  UsersIcon,
} from './Icons';

const NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/loans', label: 'Loans', icon: LoanIcon },
  { to: '/transactions', label: 'Transactions', icon: TxnIcon },
  { to: '/customers', label: 'Customers', icon: UsersIcon },
  { to: '/schemes', label: 'Schemes', icon: SchemeIcon },
  { to: '/branches', label: 'Branches', icon: BranchIcon },
  { to: '/alerts', label: 'Alerts', icon: AlertIcon },
  { to: '/reports', label: 'Reports', icon: ReportIcon },
  { to: '/administration', label: 'Administration', icon: SettingsIcon, adminOnly: true },
];

const TITLES: Array<[string, string]> = [
  ['/analytics', 'Financial Analytics'],
  ['/loans', 'Loan Portfolio'],
  ['/transactions', 'Transactions'],
  ['/customers', 'Customers'],
  ['/schemes', 'Banking Schemes'],
  ['/branches', 'Branch Performance'],
  ['/alerts', 'Alerts'],
  ['/reports', 'Reports'],
  ['/administration', 'Administration'],
  ['/', 'Executive Overview'],
];

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const title = TITLES.find(([prefix]) => location.pathname === prefix || (prefix !== '/' && location.pathname.startsWith(prefix)))?.[1] ?? 'FinTech Bank';
  const periodDriven = ['/', '/analytics', '/branches', '/reports'].some(
    (p) => location.pathname === p || (p !== '/' && location.pathname.startsWith(`${p}/`))
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const roleLabel = user?.role_label || user?.role?.replace(/_/g, ' ') || '';

  return (
    <div className="min-h-screen bg-slate-50">
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-slate-950 text-slate-300 transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-black text-white">
              ₹
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-white">FinTech Bank</p>
              <p className="text-[11px] leading-tight text-slate-400">Analytics Console</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon width={18} height={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="rounded-lg bg-white/5 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-[11px] capitalize text-slate-400">
              {roleLabel}
              {user?.branch_name ? ` · ${user.branch_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <LogoutIcon width={18} height={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
            <button
              type="button"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open sidebar"
            >
              <MenuIcon />
            </button>
            <div className="mr-auto">
              <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
              <p className="hidden text-[11px] text-slate-400 sm:block">
                {periodDriven
                  ? `Reporting period: ${location.pathname === '/reports' ? 'applies to all exports' : 'applies to this view'}`
                  : 'Reference period shown in the top bar'}
              </p>
            </div>
            <PeriodFilter />
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
              <p className="text-[11px] capitalize text-slate-400">{roleLabel}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold uppercase text-brand-700">
              {user?.name?.slice(0, 2) || 'FB'}
            </span>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-400">
            <span>FinTech Bank demo analytics · Seed data is synthetic and for demonstration only.</span>
            <span>Amounts in INR · Reported in local time</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
