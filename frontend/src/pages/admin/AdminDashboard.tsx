import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertCircle, BarChart2, CheckCircle, ChevronDown, ChevronUp,
  Download, FileText, Filter, Globe, Loader2, LogOut,
  Plus, RefreshCw, Search, Shield, Trash2, TrendingUp,
  Users, XCircle,
} from 'lucide-react';
import api from '../../lib/api';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DomainRow {
  id:                  string;
  domain:              string;
  registered_by_email: string;
  is_active:           boolean;
  user_count:          number;
  files_processed:     number;
  success_count:       number;
  failed_count:        number;
}

interface Summary {
  total:        number;
  completed:    number;
  failed:       number;
  success_rate: number;
}

interface DomainStat {
  domain:    string;
  total:     number;
  completed: number;
  failed:    number;
  rate:      number;
}

interface EmailStat {
  user_email:  string;
  user_domain: string;
  total:       number;
  completed:   number;
  failed:      number;
  rate:        number;
}

interface TimelinePoint {
  date:       string;
  total:      number;
  completed:  number;
  failed:     number;
}

interface StatsData {
  summary:   Summary;
  by_domain: Omit<DomainStat, 'rate'>[];
  by_email:  Omit<EmailStat,  'rate'>[];
  timeline:  TimelinePoint[];
}

interface Filters {
  startDate: string;
  endDate:   string;
  domain:    string;
  email:     string;
}

interface ToastItem {
  id:      number;
  type:    'success' | 'error';
  message: string;
}

type SortDir = 'asc' | 'desc';

// ─── Utilities ────────────────────────────────────────────────────────────────

function calcRate(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
}

function rateBadge(rate: number): string {
  if (rate >= 95) return 'bg-success-50 text-success-700 border-success-200';
  if (rate >= 80) return 'bg-amber-50   text-amber-700   border-amber-200';
  return                'bg-error-50   text-error-700   border-error-200';
}

function sortRows<T extends Record<string, unknown>>(
  rows: T[], col: string | null, dir: SortDir,
): T[] {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const av = a[col], bv = b[col];
    const cmp = typeof av === 'number'
      ? (av as number) - (bv as number)
      : String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
}

function buildFilterParams(f: Filters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.startDate) p.start_date = f.startDate;
  if (f.endDate)   p.end_date   = f.endDate;
  if (f.domain)    p.domain     = f.domain;
  if (f.email)     p.email      = f.email;
  return p;
}

function triggerBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function axiosMsg(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err))
    return (err.response?.data as { error?: string })?.error ?? fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const show = useCallback((type: ToastItem['type'], message: string) => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-in slide-in-from-right-4 ${
            t.type === 'success' ? 'bg-success-600 text-white' : 'bg-error-600 text-white'
          }`}
        >
          {t.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <XCircle     className="w-4 h-4 shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: () => void; disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
        checked ? 'bg-success-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition-all duration-200 ${
        checked ? 'left-[19px]' : 'left-[3px]'
      }`} />
    </button>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, accent }: {
  icon:   React.ElementType;
  label:  string;
  value:  string | number;
  accent?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${accent ?? 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-secondary-600" />
        </div>
        <div>
          <p className="text-xs text-secondary-500 font-medium leading-none mb-1">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── SortHeader ───────────────────────────────────────────────────────────────

function SortHeader({ col, label, current, dir, onSort }: {
  col: string; label: string;
  current: string | null; dir: SortDir;
  onSort: (c: string) => void;
}) {
  const active = current === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="px-4 py-3 text-left text-xs font-medium text-secondary-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap group"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (dir === 'asc'
              ? <ChevronUp   className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />)
          : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
      </span>
    </th>
  );
}

// ─── Domain Tab ───────────────────────────────────────────────────────────────

interface DomainTabProps {
  domains:      DomainRow[];
  loading:      boolean;
  refetch:      () => void;
  isSuperAdmin: boolean;
  showToast:    (type: ToastItem['type'], message: string) => void;
}

function DomainTab({ domains, loading, refetch, isSuperAdmin, showToast }: DomainTabProps) {
  const [newDomain,       setNewDomain]       = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError,   setRegisterError]   = useState('');

  const [adminEmail,    setAdminEmail]    = useState('');
  const [grantSuper,    setGrantSuper]    = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(trimmed)) {
      setRegisterError('Enter a valid domain (e.g., company.com)');
      return;
    }
    setRegisterLoading(true); setRegisterError('');
    try {
      await api.post('/admin/domains/register', { domain: trimmed });
      showToast('success', `${trimmed} registered successfully.`);
      setNewDomain(''); refetch();
    } catch (err) {
      setRegisterError(axiosMsg(err, 'Registration failed.'));
    } finally { setRegisterLoading(false); }
  }

  async function handleToggle(d: DomainRow) {
    setActionLoading(d.id);
    try {
      await api.patch(`/admin/domains/${d.id}/toggle`);
      showToast('success', `${d.domain} ${d.is_active ? 'deactivated' : 'activated'}.`);
      refetch();
    } catch { showToast('error', 'Could not update domain status.'); }
    finally  { setActionLoading(null); }
  }

  async function handleDelete(d: DomainRow) {
    setActionLoading(d.id); setConfirmDelete(null);
    try {
      await api.delete(`/admin/domains/${d.id}`);
      showToast('success', `${d.domain} deleted.`); refetch();
    } catch (err) { showToast('error', axiosMsg(err, 'Delete failed.')); }
    finally       { setActionLoading(null); }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    const email = adminEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('error', 'Enter a valid email address.'); return;
    }
    setCreateLoading(true);
    try {
      await api.post('/admin/create', { email, is_super_admin: grantSuper });
      showToast('success', `Admin ${email} created.`);
      setAdminEmail(''); setGrantSuper(false);
    } catch (err) { showToast('error', axiosMsg(err, 'Failed to create admin.')); }
    finally       { setCreateLoading(false); }
  }

  return (
    <div className="space-y-6">

      {/* Domains table */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Registered Domains</h2>
          <button
            onClick={refetch} disabled={loading}
            className="p-2 rounded-lg text-secondary-500 hover:bg-gray-100 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['Domain','Registered By','Users','Files','Success Rate','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-secondary-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && domains.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="w-5 h-5 text-secondary-400 animate-spin mx-auto" />
                </td></tr>
              ) : domains.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-secondary-400 text-sm">
                  No domains registered yet.
                </td></tr>
              ) : domains.map(d => {
                const rate     = calcRate(d.success_count, d.files_processed);
                const busyRow  = actionLoading === d.id;
                return (
                  <Fragment key={d.id}>
                    <tr className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-gray-900">{d.domain}</td>
                      <td className="px-4 py-3.5 text-secondary-600 text-xs truncate max-w-[160px]">{d.registered_by_email}</td>
                      <td className="px-4 py-3.5 text-gray-700 tabular-nums">{d.user_count}</td>
                      <td className="px-4 py-3.5 text-gray-700 tabular-nums">{d.files_processed}</td>
                      <td className="px-4 py-3.5">
                        {d.files_processed > 0
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${rateBadge(rate)}`}>{rate}%</span>
                          : <span className="text-secondary-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <Toggle checked={d.is_active} onChange={() => handleToggle(d)} disabled={busyRow} />
                      </td>
                      <td className="px-4 py-3.5">
                        {isSuperAdmin && (
                          confirmDelete === d.id ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <button onClick={() => handleDelete(d)} className="text-error-600 font-medium hover:underline">Confirm</button>
                              <span className="text-secondary-300">·</span>
                              <button onClick={() => setConfirmDelete(null)} className="text-secondary-500 hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(d.id)} disabled={busyRow}
                              className="p-1.5 rounded text-secondary-400 hover:text-error-600 hover:bg-error-50 transition-colors disabled:opacity-40"
                              title="Delete domain"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Register domain */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Register New Domain</h2>
        <form onSubmit={handleRegister} className="flex flex-wrap sm:flex-nowrap gap-3 items-start">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text" value={newDomain}
              onChange={e => { setNewDomain(e.target.value); setRegisterError(''); }}
              placeholder="company.com"
              className={`w-full px-4 py-2.5 rounded-lg border text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:ring-2 focus:ring-primary-600 focus:border-primary-600 ${
                registerError ? 'border-error-400 bg-error-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            />
            {registerError && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-error-600">
                <AlertCircle className="w-3 h-3 shrink-0" />{registerError}
              </p>
            )}
          </div>
          <button
            type="submit" disabled={registerLoading || !newDomain.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {registerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Register Domain
          </button>
        </form>
      </section>

      {/* Create Admin — super admin only */}
      {isSuperAdmin && (
        <section className="bg-white rounded-2xl border border-amber-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-gray-900">Create Admin</h2>
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Super Admin only</span>
          </div>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="flex flex-wrap sm:flex-nowrap gap-3 items-start">
              <input
                type="email" value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="admin@company.com"
                className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 hover:border-gray-400"
              />
              <button
                type="submit" disabled={createLoading || !adminEmail.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary-700 text-white text-sm font-medium hover:bg-secondary-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Create Admin
              </button>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
              <input
                type="checkbox" checked={grantSuper} onChange={e => setGrantSuper(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Grant Super Admin privileges</span>
            </label>
          </form>
        </section>
      )}
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Filters = { startDate: '', endDate: '', domain: '', email: '' };

interface StatsTabProps {
  domains:   DomainRow[];
  showToast: (type: ToastItem['type'], message: string) => void;
}

function StatsTab({ domains, showToast }: StatsTabProps) {
  const [draft,     setDraft]     = useState<Filters>(EMPTY_FILTERS);
  const [applied,   setApplied]   = useState<Filters>(EMPTY_FILTERS);
  const [stats,     setStats]     = useState<StatsData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  const [dSort, setDSort] = useState<string | null>(null);
  const [dDir,  setDDir]  = useState<SortDir>('desc');
  const [eSort, setESort] = useState<string | null>(null);
  const [eDir,  setEDir]  = useState<SortDir>('desc');
  const [eSearch, setESearch] = useState('');

  function toggleSort(
    col: string,
    cur: string | null, setCur: (v: string) => void,
    curDir: SortDir, setDir: (v: SortDir) => void,
  ) {
    setDir(cur === col && curDir === 'desc' ? 'asc' : 'desc');
    setCur(col);
  }

  const fetchStats = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const { data } = await api.get<{ success: boolean; data: StatsData }>(
        '/admin/stats', { params: buildFilterParams(f) }
      );
      if (data.success) setStats(data.data);
    } catch { showToast('error', 'Failed to load statistics.'); }
    finally  { setLoading(false); }
  }, [showToast]);

  useEffect(() => { void fetchStats(EMPTY_FILTERS); }, [fetchStats]);

  function handleApply() { setApplied({ ...draft }); void fetchStats(draft); }

  function handleClear() {
    setDraft(EMPTY_FILTERS); setApplied(EMPTY_FILTERS);
    void fetchStats(EMPTY_FILTERS);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get('/admin/stats/export', {
        params: buildFilterParams(applied), responseType: 'blob',
      });
      const date = new Date().toISOString().split('T')[0];
      triggerBlob(res.data as Blob, `stats-export-${date}.csv`);
    } catch { showToast('error', 'Export failed.'); }
    finally  { setExporting(false); }
  }

  // Chart data
  const barData = useMemo(() =>
    (stats?.by_domain ?? []).map(d => ({
      domain: d.domain.length > 14 ? d.domain.slice(0, 12) + '…' : d.domain,
      rate:   calcRate(d.completed, d.total),
    })),
  [stats]);

  const lineData = useMemo(() =>
    (stats?.timeline ?? []).map(t => ({
      date:        t.date.slice(5),
      Successful:  t.completed,
      Failed:      t.failed,
    })),
  [stats]);

  // Sorted domain rows
  const sortedDomains = useMemo<DomainStat[]>(() => {
    const rows = (stats?.by_domain ?? []).map(d => ({
      ...d, rate: calcRate(d.completed, d.total),
    }));
    return sortRows(rows as unknown as Record<string, unknown>[], dSort, dDir) as unknown as DomainStat[];
  }, [stats, dSort, dDir]);

  // Sorted + filtered email rows
  const sortedEmails = useMemo<EmailStat[]>(() => {
    const rows = (stats?.by_email ?? [])
      .map(e => ({ ...e, rate: calcRate(e.completed, e.total) }))
      .filter(e => !eSearch ||
        e.user_email.toLowerCase().includes(eSearch.toLowerCase()) ||
        e.user_domain.toLowerCase().includes(eSearch.toLowerCase())
      );
    return sortRows(rows as unknown as Record<string, unknown>[], eSort, eDir) as unknown as EmailStat[];
  }, [stats, eSort, eDir, eSearch]);

  const s = stats?.summary;

  return (
    <div className="space-y-6">

      {/* Filters */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-secondary-500" />Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Start Date', type: 'date',  key: 'startDate' as const },
            { label: 'End Date',   type: 'date',  key: 'endDate'   as const },
          ].map(({ label, type, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-secondary-600 mb-1.5">{label}</label>
              <input
                type={type} value={draft[key]}
                onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-secondary-600 mb-1.5">Domain</label>
            <select
              value={draft.domain}
              onChange={e => setDraft(p => ({ ...p, domain: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            >
              <option value="">All Domains</option>
              {domains.map(d => <option key={d.id} value={d.domain}>{d.domain}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 mb-1.5">Email</label>
            <input
              type="text" value={draft.email} placeholder="user@company.com"
              onChange={e => setDraft(p => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleApply} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            Apply Filters
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-secondary-600 hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleExport} disabled={exporting}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-secondary-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}    label="Total Processed" value={s?.total    ?? '—'} />
        <StatCard icon={CheckCircle} label="Successful"      value={s?.completed ?? '—'} accent="border-success-200" />
        <StatCard icon={XCircle}     label="Failed"          value={s?.failed    ?? '—'} accent="border-error-200"   />
        <StatCard
          icon={TrendingUp} label="Success Rate"
          value={s ? `${s.success_rate.toFixed(1)}%` : '—'}
          accent={s ? (s.success_rate >= 95 ? 'border-success-300' : s.success_rate >= 80 ? 'border-amber-300' : 'border-error-300') : undefined}
        />
      </div>

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-secondary-500" />Success Rate by Domain
            </h3>
            {barData.length === 0
              ? <div className="h-52 flex items-center justify-center text-secondary-400 text-sm">No data</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="domain" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Success Rate']} />
                    <Bar dataKey="rate" name="Success Rate" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-secondary-500" />Processing Timeline
            </h3>
            {lineData.length === 0
              ? <div className="h-52 flex items-center justify-center text-secondary-400 text-sm">No data</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Successful" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Failed"     stroke="#dc2626" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </section>
        </div>
      )}

      {/* By domain table */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Stats by Domain</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[['domain','Domain'],['total','Total'],['completed','Success'],['failed','Failed'],['rate','Success Rate']].map(([c, l]) => (
                  <SortHeader key={c} col={c} label={l} current={dSort} dir={dDir}
                    onSort={col => toggleSort(col, dSort, setDSort, dDir, setDDir)} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-secondary-400 animate-spin mx-auto" /></td></tr>
                : sortedDomains.length === 0
                  ? <tr><td colSpan={5} className="px-4 py-10 text-center text-secondary-400 text-sm">No data</td></tr>
                  : sortedDomains.map(d => (
                    <tr key={d.domain} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.domain}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{d.total}</td>
                      <td className="px-4 py-3 tabular-nums text-success-600">{d.completed}</td>
                      <td className="px-4 py-3 tabular-nums text-error-600">{d.failed}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${rateBadge(d.rate)}`}>
                          {d.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* By email table */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 shrink-0">Stats by Email</h3>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400" />
            <input
              type="text" value={eSearch} onChange={e => setESearch(e.target.value)}
              placeholder="Search email or domain…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[['user_email','Email'],['user_domain','Domain'],['total','Total'],['completed','Success'],['failed','Failed'],['rate','Success Rate']].map(([c, l]) => (
                  <SortHeader key={c} col={c} label={l} current={eSort} dir={eDir}
                    onSort={col => toggleSort(col, eSort, setESort, eDir, setEDir)} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? <tr><td colSpan={6} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-secondary-400 animate-spin mx-auto" /></td></tr>
                : sortedEmails.length === 0
                  ? <tr><td colSpan={6} className="px-4 py-10 text-center text-secondary-400 text-sm">
                      {eSearch ? 'No results match your search.' : 'No data'}
                    </td></tr>
                  : sortedEmails.map((e, i) => (
                    <tr key={`${e.user_email}-${i}`} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-900 truncate max-w-[180px]">{e.user_email}</td>
                      <td className="px-4 py-3 text-xs text-secondary-600">{e.user_domain}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{e.total}</td>
                      <td className="px-4 py-3 tabular-nums text-success-600">{e.completed}</td>
                      <td className="px-4 py-3 tabular-nums text-error-600">{e.failed}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${rateBadge(e.rate)}`}>
                          {e.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

type Tab = 'domains' | 'stats';

export default function AdminDashboard() {
  const { admin, logout } = useAdminAuth();
  const navigate          = useNavigate();
  const { toasts, show: showToast } = useToast();

  const [activeTab,      setActiveTab]      = useState<Tab>('domains');
  const [domains,        setDomains]        = useState<DomainRow[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);

  const fetchDomains = useCallback(async () => {
    setDomainsLoading(true);
    try {
      const { data } = await api.get<{ success: boolean; data: DomainRow[] }>('/admin/domains');
      if (data.success) setDomains(data.data);
    } catch { showToast('error', 'Failed to load domains.'); }
    finally  { setDomainsLoading(false); }
  }, [showToast]);

  useEffect(() => { void fetchDomains(); }, [fetchDomains]);

  function handleLogout() { logout(); navigate('/admin/login', { replace: true }); }

  const isSuperAdmin = admin?.is_super_admin ?? false;

  return (
    <div className="min-h-screen bg-gray-100">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-secondary-900 border-b border-secondary-700 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary-700 border border-secondary-600 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Admin Dashboard</span>
            {isSuperAdmin && (
              <span className="hidden sm:inline text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                Super Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-secondary-400 truncate max-w-[220px]">
              {admin?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-secondary-400 hover:bg-secondary-700 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex" role="tablist">
            {([
              { id: 'domains', label: 'Domain Management', icon: Globe    },
              { id: 'stats',   label: 'Statistics',        icon: BarChart2 },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id} role="tab" aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-secondary-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'domains'
          ? <DomainTab domains={domains} loading={domainsLoading} refetch={fetchDomains} isSuperAdmin={isSuperAdmin} showToast={showToast} />
          : <StatsTab  domains={domains} showToast={showToast} />
        }
      </main>
    </div>
  );
}
