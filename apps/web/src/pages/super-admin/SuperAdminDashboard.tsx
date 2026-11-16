import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  DoorOpen,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import {
  api,
  type SuperAdminAnalytics,
  type SuperAdminCompany,
  type SuperAdminOverview,
} from '../../lib/api';
import {
  formatPlanLabel,
  PLAN_OPTIONS,
  type SubscriptionPlan,
} from '@pos-inventory/shared';
import { useTenantContextStore } from '../../stores/tenantContextStore';

type Tab = 'overview' | 'companies' | 'analytics' | 'settings';

const planBadge = (plan: string) => {
  const bucket = formatPlanLabel(plan);
  const styles =
    plan === 'yearly' || plan === 'premium'
      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
      : plan === 'six_month' || plan === 'basic'
        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
        : 'bg-secondary text-foreground';
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${styles}`}>
      {bucket}
    </span>
  );
};

const statusBadge = (status: string) => {
  const styles =
    status === 'active'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 'suspended'
        ? 'bg-red-500/15 text-red-700 dark:text-red-300'
        : status === 'expired'
          ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize ${styles}`}>
      {status}
    </span>
  );
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';

const formatCurrency = (n: number) =>
  `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [analytics, setAnalytics] = useState<SuperAdminAnalytics | null>(null);
  const [companies, setCompanies] = useState<SuperAdminCompany[]>([]);
  const [platformFee, setPlatformFee] = useState(5);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<SuperAdminCompany | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  const [newCompanyName, setNewCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [plan, setPlan] = useState('trial');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFullName, setAdminFullName] = useState('');

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPlan, setEditPlan] = useState<SubscriptionPlan>('trial');
  const [editFee, setEditFee] = useState('');
  const [editRenewal, setEditRenewal] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');

  useEffect(() => {
    void checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
      return;
    }
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (!userData || userData.role !== 'super_admin') {
      toast.error('Access denied');
      navigate('/login');
    }
  };

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [overviewRes, analyticsRes, companiesRes, settingsRes] = await Promise.all([
        api.getSuperAdminOverview(),
        api.getSuperAdminAnalytics(),
        api.getSuperAdminCompanies(),
        api.getPlatformSettings(),
      ]);
      setOverview(overviewRes.data);
      setAnalytics(analyticsRes.data);
      setCompanies(companiesRes.data);
      setPlatformFee(settingsRes.data.platform_fee_percent);
      setSupportEmail(settingsRes.data.support_email ?? '');
      setSupportPhone(settingsRes.data.support_phone ?? '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load platform data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleLogout = async () => {
    useTenantContextStore.getState().exitTenant();
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword || !adminFullName || !newCompanyName) {
      toast.warning('Fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.createCompany({
        companyName: newCompanyName,
        phone: companyPhone,
        location: companyLocation,
        plan,
        adminEmail,
        adminPassword,
        adminFullName,
      });
      if (!data.success) throw new Error(data.error || 'Failed');
      toast.success(`${newCompanyName} created`);
      setIsCreateOpen(false);
      setNewCompanyName('');
      setCompanyPhone('');
      setCompanyLocation('');
      setPlan('trial');
      setAdminEmail('');
      setAdminPassword('');
      setAdminFullName('');
      await loadAll(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  const closeActionsMenu = useCallback(() => {
    setOpenMenuId(null);
    setMenuPos(null);
  }, []);

  const openEdit = (company: SuperAdminCompany) => {
    closeActionsMenu();
    setEditingCompany(company);
    setEditName(company.name);
    setEditPhone(company.phone ?? '');
    setEditLocation(company.location ?? '');
    setEditPlan(company.plan as SubscriptionPlan);
    setEditFee(company.platform_fee_percent != null ? String(company.platform_fee_percent) : '');
    setEditRenewal(company.plan_renewal_at ? company.plan_renewal_at.slice(0, 10) : '');
    setEditAdminEmail(company.contact_email ?? company.admin_email ?? '');
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setSubmitting(true);
    try {
      await api.updateSuperAdminCompany(editingCompany.id, {
        name: editName,
        phone: editPhone || undefined,
        location: editLocation || undefined,
        plan: editPlan,
        platform_fee_percent: editFee === '' ? null : Number(editFee),
        plan_renewal_at: editRenewal ? new Date(editRenewal).toISOString() : undefined,
      });
      toast.success('Company updated');
      setIsEditOpen(false);
      await loadAll(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtend = async (company: SuperAdminCompany) => {
    closeActionsMenu();
    try {
      await api.updateSuperAdminCompany(company.id, { extend_plan: true });
      toast.success(`${company.name} subscription extended`);
      await loadAll(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Renewal failed');
    }
  };

  const handleToggleStatus = async (company: SuperAdminCompany) => {
    closeActionsMenu();
    const next = company.status === 'active' ? 'suspended' : 'active';
    try {
      await api.setSuperAdminCompanyStatus(company.id, next);
      toast.success(next === 'active' ? 'Company enabled' : 'Company disabled');
      await loadAll(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  const handleDelete = async (company: SuperAdminCompany) => {
    closeActionsMenu();
    if (!window.confirm(`Delete "${company.name}" and all its data? This cannot be undone.`)) return;
    try {
      await api.deleteSuperAdminCompany(company.id);
      toast.success(`${company.name} deleted`);
      await loadAll(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleEnterTenant = (company: SuperAdminCompany) => {
    closeActionsMenu();
    useTenantContextStore.getState().enterTenant({
      id: company.id,
      name: company.name,
    });
    toast.success(`Entering ${company.name}`, {
      description: 'You are viewing this tenant as super admin',
    });
    navigate('/admin/inventory');
  };

  const toggleActionsMenu = (companyId: string) => {
    if (openMenuId === companyId) {
      closeActionsMenu();
      return;
    }
    const btn = menuButtonRefs.current[companyId];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 180;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setMenuPos({ top: rect.bottom + 6, left });
    setOpenMenuId(companyId);
  };

  useLayoutEffect(() => {
    if (!openMenuId) return;

    const reposition = () => {
      const btn = menuButtonRefs.current[openMenuId];
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuWidth = menuPanelRef.current?.offsetWidth ?? 180;
      const menuHeight = menuPanelRef.current?.offsetHeight ?? 200;
      let top = rect.bottom + 6;
      if (top + menuHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuHeight - 6);
      }
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setMenuPos({ top, left });
    };

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!openMenuId) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuPanelRef.current?.contains(target)) return;
      const btn = menuButtonRefs.current[openMenuId];
      if (btn?.contains(target)) return;
      closeActionsMenu();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeActionsMenu();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuId, closeActionsMenu]);

  const savePlatformSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.updatePlatformSettings({
        platform_fee_percent: platformFee,
        support_email: supportEmail.trim() || null,
        support_phone: supportPhone.trim() || null,
      });
      setPlatformFee(res.data.platform_fee_percent);
      setSupportEmail(res.data.support_email ?? '');
      setSupportPhone(res.data.support_phone ?? '');
      toast.success('Platform settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingSettings(false);
    }
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'companies', label: 'Companies', icon: <Building2 className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'Platform', icon: <Settings2 className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 opacity-80" />
          <p className="text-sm opacity-70">Loading platform dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-900 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">Platform Control</h1>
              <p className="text-xs text-white/50 truncate">Super admin · marketplace & tenants</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadAll(true)}
              className="text-white/80 hover:text-white hover:bg-white/10 border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10 border border-white/10"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <nav className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total companies', value: overview.total_companies, icon: Building2, color: 'from-blue-500/20 to-blue-600/5' },
                { label: 'Active', value: overview.active_companies, icon: Users, color: 'from-emerald-500/20 to-emerald-600/5' },
                { label: 'Renewal due (7d)', value: overview.expiring_soon, icon: CalendarClock, color: 'from-amber-500/20 to-amber-600/5' },
                { label: 'Paystack connected', value: overview.paystack_connected, icon: Wallet, color: 'from-violet-500/20 to-violet-600/5' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${color} p-4`}>
                  <Icon className="w-5 h-5 text-white/60 mb-2" />
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-white/50 mt-1">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <Store className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-semibold">Marketplace activity</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-white/50">Online orders</p>
                    <p className="text-xl font-bold tabular-nums">{overview.online_orders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">GMV (recent)</p>
                    <p className="text-xl font-bold tabular-nums">{formatCurrency(overview.marketplace_gmv)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Platform fees</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-400">
                      {formatCurrency(overview.platform_fees_collected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Default fee</p>
                    <p className="text-xl font-bold tabular-nums">{overview.platform_fee_percent}%</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <h2 className="font-semibold">Attention needed</h2>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span className="text-white/60">Suspended</span>
                    <span className="font-semibold text-red-300">{overview.suspended_companies}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-white/60">Expired</span>
                    <span className="font-semibold text-orange-300">{overview.expired_companies}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-white/60">Expiring soon</span>
                    <span className="font-semibold text-amber-300">{overview.expiring_soon}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'companies' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Tenant companies</h2>
                <p className="text-sm text-white/50">Manage plans, payouts, and access</p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} variant="primary">
                <Plus className="w-4 h-4 mr-1.5" />
                Add company
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/50 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Renewal</th>
                      <th className="px-4 py-3">Fee</th>
                      <th className="px-4 py-3">Paystack</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr key={company.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <p className="font-medium">{company.name}</p>
                          {company.location && (
                            <p className="text-[10px] text-white/40 truncate max-w-[140px]">{company.location}</p>
                          )}
                          <p className="text-[10px] text-white/30 font-mono">{company.id.slice(-8)}</p>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {company.contact_phone || company.phone ? (
                            <a
                              href={`tel:${company.contact_phone ?? company.phone}`}
                              className="text-white/80 hover:text-white hover:underline"
                            >
                              {company.contact_phone ?? company.phone}
                            </a>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[180px]">
                          {company.contact_email || company.admin_email ? (
                            <a
                              href={`mailto:${company.contact_email ?? company.admin_email}`}
                              className="text-white/80 hover:text-white hover:underline truncate block"
                              title={company.contact_email ?? company.admin_email ?? undefined}
                            >
                              {company.contact_email ?? company.admin_email}
                            </a>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                          {company.admin_name && (
                            <p className="text-[10px] text-white/40 truncate mt-0.5">{company.admin_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">{planBadge(company.plan)}</td>
                        <td className="px-4 py-3">
                          {statusBadge(company.subscription.access === 'warning' ? 'renewal soon' : company.status)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p>{formatDate(company.plan_renewal_at)}</p>
                          {company.subscription.days_until_renewal != null && company.subscription.days_until_renewal > 0 && (
                            <p className="text-white/40">{company.subscription.days_until_renewal}d left</p>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {company.platform_fee_percent ?? overview?.platform_fee_percent ?? 5}%
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] capitalize text-white/60">
                            {company.paystack_subaccount_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            ref={(el) => {
                              menuButtonRefs.current[company.id] = el;
                            }}
                            onClick={() => toggleActionsMenu(company.id)}
                            className="p-2 rounded-lg hover:bg-white/10"
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === company.id}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Online orders (30d)', value: analytics.totals.online_orders_30d },
                { label: 'Online revenue (30d)', value: formatCurrency(analytics.totals.online_revenue_30d) },
                { label: 'Platform fees (30d)', value: formatCurrency(analytics.totals.platform_fees_30d) },
                { label: 'POS sales (30d)', value: formatCurrency(analytics.totals.pos_sales_30d) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">{label}</p>
                  <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Plan breakdown
                </h3>
                <div className="space-y-2">
                  {analytics.plan_breakdown.map((p) => (
                    <div key={p.plan} className="flex items-center justify-between text-sm">
                      <span className="text-white/70">{formatPlanLabel(p.plan)}</span>
                      <span className="font-semibold">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Status breakdown
                </h3>
                <div className="space-y-2">
                  {analytics.status_breakdown.map((s) => (
                    <div key={s.status} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-white/70">{s.status}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="font-semibold mb-4">Top companies by online revenue (30d)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 text-xs border-b border-white/10">
                      <th className="pb-2 pr-4">Company</th>
                      <th className="pb-2 pr-4">Online</th>
                      <th className="pb-2 pr-4">POS</th>
                      <th className="pb-2 pr-4">Fees</th>
                      <th className="pb-2">Paystack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_companies.map((c) => (
                      <tr key={c.company_id} className="border-b border-white/5">
                        <td className="py-2 pr-4 font-medium">{c.name}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatCurrency(c.online_revenue)}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatCurrency(c.pos_revenue)}</td>
                        <td className="py-2 pr-4 tabular-nums text-emerald-400">{formatCurrency(c.platform_fees)}</td>
                        <td className="py-2 capitalize text-white/60">{c.paystack_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-lg space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-violet-500/20">
                  <CreditCard className="w-5 h-5 text-violet-300" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Marketplace platform fee</h2>
                  <p className="text-sm text-white/50 mt-1">
                    Default percentage kept from each Paystack online order. Can be overridden per company.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Default fee (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.1}
                  value={platformFee}
                  onChange={(e) => setPlatformFee(Number(e.target.value))}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20">
                  <Mail className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Renewal support contact</h2>
                  <p className="text-sm text-white/50 mt-1">
                    Shown to tenants when their subscription is expiring or locked. The email button opens
                    their mail app with a pre-filled renewal request.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Support email *</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="billing@yourplatform.com"
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Support phone (optional)</label>
                <input
                  type="tel"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+233 20 000 0000"
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <Button onClick={() => void savePlatformSettings()} loading={savingSettings} fullWidth>
                Save platform settings
              </Button>
            </div>
          </div>
        )}
      </div>

      {openMenuId &&
        menuPos &&
        createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            className="fixed z-[200] min-w-[180px] rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1 text-left"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {(() => {
              const company = companies.find((c) => c.id === openMenuId);
              if (!company) return null;
              return (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 text-emerald-300"
                    onClick={() => handleEnterTenant(company)}
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    Enter tenant
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                    onClick={() => openEdit(company)}
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                    onClick={() => void handleExtend(company)}
                  >
                    Renew plan
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                    onClick={() => void handleToggleStatus(company)}
                  >
                    {company.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                    onClick={() => void handleDelete(company)}
                  >
                    Delete
                  </button>
                </>
              );
            })()}
          </div>,
          document.body,
        )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create company" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Company name *" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
            <Input label="Location" value={companyLocation} onChange={(e) => setCompanyLocation(e.target.value)} />
          </div>
          <Select
            label="Plan"
            value={plan}
            onChange={setPlan}
            options={PLAN_OPTIONS}
          />
          <Input label="Admin name *" value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} required />
          <Input label="Admin email *" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          <Input label="Admin password *" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} minLength={8} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Update company" size="lg">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input label="Company name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Input label="Location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
          </div>
          <Input
            label="Admin email"
            type="email"
            value={editAdminEmail}
            readOnly
            disabled
            placeholder="No admin email on file"
          />
          <Select
            label="Plan"
            value={editPlan}
            onChange={(v) => setEditPlan(v as SubscriptionPlan)}
            options={PLAN_OPTIONS}
          />
          <Input label="Platform fee override (%)" type="number" value={editFee} onChange={(e) => setEditFee(e.target.value)} placeholder="Leave empty for default" />
          <Input label="Renewal date" type="date" value={editRenewal} onChange={(e) => setEditRenewal(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Save changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SuperAdminDashboard;
