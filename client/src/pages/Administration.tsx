import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/useApi';
import { api, errorMessage } from '../lib/api';
import { count, shortDate } from '../lib/format';
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  Loading,
  PageHeader,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
  selectClass,
  Spinner,
} from '../components/ui';
import { CloseIcon, LockIcon, SettingsIcon } from '../components/Icons';

const ROLES = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'bank_manager', label: 'Bank manager' },
  { value: 'financial_officer', label: 'Financial officer' },
  { value: 'viewer', label: 'Viewer' },
];

const emptyForm = {
  employee_id: '',
  name: '',
  email: '',
  password: '',
  role: 'viewer',
  branch_id: '',
};

export function Administration() {
  const { user, isAdmin } = useAuth();
  const users = useApi<any>(isAdmin ? '/settings/users' : null);
  const summary = useApi<any>(isAdmin ? '/settings/summary' : null);
  const branches = useApi<any>('/branches');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowWorking, setRowWorking] = useState<number | null>(null);

  if (!isAdmin) {
    return (
      <div className="animate-fadeIn">
        <PageHeader title="Administration" subtitle="Employee and access management" />
        <Card className="flex flex-col items-center p-12 text-center">
          <span className="rounded-full bg-slate-100 p-4 text-slate-400">
            <LockIcon width={28} height={28} />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-800">Super admin access required</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Your role ({user?.role_label || user?.role}) can view financial data but cannot create employees or change
            access. Ask a super admin if you need elevated permissions.
          </p>
        </Card>
      </div>
    );
  }

  const roleCounts: Record<string, number> = {};
  (summary.data?.roles || []).forEach((r: any) => (roleCounts[r.role] = r.count));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.post('/settings/users', { ...form, branch_id: form.branch_id || undefined });
      setOpen(false);
      setForm(emptyForm);
      setNotice('Employee account created successfully.');
      users.reload();
      summary.reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (id: number, role: string) => {
    setRowWorking(id);
    setNotice(null);
    try {
      await api.patch(`/settings/users/${id}/role`, { role });
      users.reload();
      summary.reload();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setRowWorking(null);
    }
  };

  const toggleStatus = async (u: any) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive' && !window.confirm(`Deactivate ${u.name}? They will no longer be able to sign in.`)) {
      return;
    }
    setRowWorking(u.user_id);
    setNotice(null);
    try {
      await api.patch(`/settings/users/${u.user_id}/status`, { status: next });
      users.reload();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setRowWorking(null);
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Administration"
        subtitle="Manage employee access, roles and branch assignments"
        actions={
          <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
            <SettingsIcon width={15} height={15} /> Add employee
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total employees</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{count(users.data?.users?.length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch managers</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{count(roleCounts.bank_manager)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finance & viewers</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {count((roleCounts.financial_officer || 0) + (roleCounts.viewer || 0))}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branches</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{count(summary.data?.branches)}</p>
        </Card>
      </div>

      {notice ? (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
          {notice}
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader title="Employee directory" subtitle="Role changes and deactivation take effect on the next sign-in" />
        {users.loading && !users.data ? (
          <Loading />
        ) : users.error ? (
          <ErrorState message={users.error} onRetry={users.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last login</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {(users.data?.users || []).map((u: any) => {
                  const isSelf = u.user_id === user?.user_id;
                  return (
                    <tr key={u.user_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {u.name} {isSelf ? <span className="text-[10px] font-semibold text-brand-600">(you)</span> : null}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">{u.employee_id}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{u.email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{u.branch_name}</td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
                          value={u.role}
                          disabled={rowWorking === u.user_id}
                          onChange={(e) => changeRole(u.user_id, e.target.value)}
                          aria-label={`Role for ${u.name}`}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status === 'active' ? 'Active' : 'Inactive'} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.last_login_at ? shortDate(u.last_login_at) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{shortDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-600 hover:text-brand-800 disabled:opacity-40"
                          disabled={isSelf || rowWorking === u.user_id}
                          onClick={() => toggleStatus(u)}
                          title={isSelf ? 'You cannot deactivate your own account' : undefined}
                        >
                          {rowWorking === u.user_id ? <Spinner size={12} /> : u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Branch directory" subtitle="Branches available for employee assignment" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Code</th>
                <th className="px-4 py-2.5 font-semibold">Branch</th>
                <th className="px-4 py-2.5 font-semibold">City</th>
                <th className="px-4 py-2.5 font-semibold">Address</th>
                <th className="px-4 py-2.5 font-semibold">Phone</th>
              </tr>
            </thead>
            <tbody>
              {(branches.data?.branches || []).map((b: any) => (
                <tr key={b.branch_id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{b.branch_code}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{b.branch_name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{b.city}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{b.address}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{b.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !saving && setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-cardHover">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Add employee</h3>
                <p className="mt-0.5 text-xs text-slate-500">Create an account with role-based access</p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => !saving && setOpen(false)}
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form className="space-y-3 p-5" onSubmit={submit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="new-employee-id">Employee ID</label>
                  <input
                    id="new-employee-id"
                    className={inputClass}
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    placeholder="e.g. BM1009"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="new-role">Role</label>
                  <select
                    id="new-role"
                    className={selectClass}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="new-name">Full name</label>
                <input
                  id="new-name"
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="new-email">Email (optional)</label>
                <input
                  id="new-email"
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="new-branch">Branch</label>
                  <select
                    id="new-branch"
                    className={selectClass}
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  >
                    <option value="">Head office (default)</option>
                    {(branches.data?.branches || []).map((b: any) => (
                      <option key={b.branch_id} value={b.branch_id}>
                        {b.branch_code} · {b.branch_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="new-password">Temporary password</label>
                  <input id="new-password" type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" autoComplete="new-password" />
                </div>
              </div>
              {formError ? (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              ) : null}
              <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
                <LockIcon width={12} height={12} className="mt-0.5 shrink-0" />
                Passwords are hashed with bcrypt. Share the temporary password securely and ask the employee to change it after signing in.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className={btnSecondary} onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? <Spinner size={14} /> : null}
                  Create employee
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
