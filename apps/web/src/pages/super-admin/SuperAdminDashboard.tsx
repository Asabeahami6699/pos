import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  DoorOpen,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
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
      ? 'bg-primary/15 text-primary'
      : plan === 'six_month' || plan === 'basic'
        ? 'bg-sky-500/15 text-sky-700'
        : 'bg-secondary text-foreground';
  return (
    <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold rounded-full ${styles}`}>
      {bucket}
    </span>
  );
};

const statusBadge = (status: string) => {
  const styles =
    status === 'active'
      ? 'bg-emerald-500/10 text-emerald-700'
      : status === 'suspended'
        ? 'bg-red-500/10 text-red-600'
        : status === 'expired'
          ? 'bg-orange-500/10 text-orange-600'
          : 'bg-amber-500/10 text-amber-700';
  return (
    <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold rounded-full capitalize ${styles}`}>
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
  const [companyQuery, setCompanyQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expired'>('all');

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
    void api
      .logTenantAccess({
        company_id: company.id,
        action: 'enter',
        meta: { company_name: company.name },
      })
      .catch(() => {
        /* audit best-effort */
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
    const menuWidth = 200;
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
      const menuWidth = menuPanelRef.current?.offsetWidth ?? 200;
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

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return companies.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        c.name,
        c.location,
        c.phone,
        c.contact_phone,
        c.contact_email,
        c.admin_email,
        c.admin_name,
        c.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [companies, companyQuery, statusFilter]);

  const navItems: Array<{ id: Tab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
    {
      id: 'companies',
      label: 'Tenants',
      icon: <Building2 className="w-5 h-5" />,
      badge: overview?.expiring_soon || undefined,
    },
    { id: 'analytics', label: 'Stats', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'settings', label: 'Setup', icon: <Settings2 className="w-5 h-5" /> },
  ];

  const switchTab = (tab: Tab) => setActiveTab(tab);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground">Loading Control Plane…</h2>
          <p className="text-muted-foreground mt-2">Setting up platform dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen page-shell overflow-hidden">
      {/* Dark icon sidebar — same language as POS */}
      <aside className="hidden md:flex w-[88px] shrink-0 flex-col items-center py-5 bg-[hsl(222_47%_11%)] text-white">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-extrabold text-sm shadow-lg mb-6">
          SA
        </div>

        <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => switchTab(item.id)}
                className={`relative w-full flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-2 w-full space-y-2">
          <button
            type="button"
            onClick={() => void loadAll(true)}
            className="w-full flex flex-col items-center gap-1 py-2.5 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-semibold">Sync</span>
          </button>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-2.5 text-center">
            <HelpCircle className="w-4 h-4 mx-auto text-white/60 mb-1" />
            <p className="text-[9px] font-semibold text-white/80">Platform</p>
            <p className="text-[8px] text-orange-300 mt-1">Super admin</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top header — ShopZone like POS */}
        <header className="bg-card border-b border-border px-4 sm:px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-foreground">Shop</span>
                <span className="text-primary">Zone</span>
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary">
                Admin
              </span>
            </div>

            <div className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {overview?.active_companies ?? 0} live tenants
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 pl-1">
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div className="leading-tight max-w-[120px]">
                <p className="text-sm font-semibold text-foreground truncate">Super admin</p>
                <p className="text-[11px] text-muted-foreground truncate">Platform control</p>
              </div>
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add company</span>
            </Button>

            <Button
              onClick={() => void handleLogout()}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* Mobile nav tabs */}
        <div className="md:hidden bg-card/80 border-b border-border px-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max py-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={`m-${item.id}`}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`relative px-3 py-2.5 text-xs font-semibold rounded-lg capitalize ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-1 inline-flex min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="max-w-6xl mx-auto space-y-5">
            {activeTab === 'overview' && overview && (
              <>
                <div className="pos-promo-banner text-white">
                  <div className="relative z-10 max-w-xl">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                      Platform pulse
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">
                      {overview.active_companies} live tenants on ShopZone
                    </h2>
                    <p className="text-sm text-white/85 mt-2">
                      {formatCurrency(overview.marketplace_gmv)} recent GMV ·{' '}
                      <span className="font-bold">{formatCurrency(overview.platform_fees_collected)}</span>{' '}
                      fees collected
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => switchTab('companies')}
                        className="px-4 py-2 rounded-xl bg-white text-primary text-sm font-bold shadow-md hover:bg-white/95"
                      >
                        Manage tenants
                      </button>
                      <button
                        type="button"
                        onClick={() => switchTab('analytics')}
                        className="px-4 py-2 rounded-xl bg-white/15 text-white text-sm font-bold border border-white/25 hover:bg-white/25"
                      >
                        View analytics
                      </button>
                    </div>
                  </div>
                  <div className="relative z-10 flex items-center gap-3">
                    <Store className="w-12 h-12 text-white/40 hidden sm:block" />
                  </div>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: 'Total companies', value: overview.total_companies, icon: Building2 },
                    { label: 'Active', value: overview.active_companies, icon: Users },
                    { label: 'Renewal due (7d)', value: overview.expiring_soon, icon: CalendarClock },
                    { label: 'Paystack connected', value: overview.paystack_connected, icon: Wallet },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="pos-product-card">
                      <Icon className="w-4 h-4 text-primary mb-3" />
                      <p className="text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="pos-product-card lg:col-span-2 !p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Store className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-foreground">Marketplace activity</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Online orders</p>
                        <p className="text-xl font-extrabold tabular-nums mt-1">{overview.online_orders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">GMV (recent)</p>
                        <p className="text-xl font-extrabold tabular-nums mt-1 text-orange-500">
                          {formatCurrency(overview.marketplace_gmv)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Platform fees</p>
                        <p className="text-xl font-extrabold tabular-nums mt-1 text-orange-500">
                          {formatCurrency(overview.platform_fees_collected)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Default fee</p>
                        <p className="text-xl font-extrabold tabular-nums mt-1">
                          {overview.platform_fee_percent}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pos-product-card !p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4 text-orange-500" />
                      <h3 className="font-bold text-foreground">Needs attention</h3>
                    </div>
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Suspended</span>
                        <span className="font-bold text-red-600">{overview.suspended_companies}</span>
                      </li>
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Expired</span>
                        <span className="font-bold text-orange-600">{overview.expired_companies}</span>
                      </li>
                      <li className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Expiring soon</span>
                        <span className="font-bold text-amber-600">{overview.expiring_soon}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'companies' && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      value={companyQuery}
                      onChange={(e) => setCompanyQuery(e.target.value)}
                      placeholder="Search name, phone, email, location…"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {(['all', 'active', 'suspended', 'expired'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={`pos-category-chip capitalize whitespace-nowrap ${
                          statusFilter === s ? 'pos-category-chip-active' : ''
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Showing {filteredCompanies.length} of {companies.length} tenants
                </p>

                <div className="md:hidden space-y-3">
                  {filteredCompanies.map((company) => (
                    <div key={company.id} className="pos-product-card space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold truncate">{company.name}</p>
                          {company.location && (
                            <p className="text-xs text-muted-foreground truncate">{company.location}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          ref={(el) => {
                            menuButtonRefs.current[company.id] = el;
                          }}
                          onClick={() => toggleActionsMenu(company.id)}
                          className="p-2 rounded-xl hover:bg-secondary"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {planBadge(company.plan)}
                        {statusBadge(
                          company.subscription.access === 'warning'
                            ? 'renewal soon'
                            : company.status,
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Renewal</p>
                          <p className="font-semibold">{formatDate(company.plan_renewal_at)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Fee</p>
                          <p className="font-semibold tabular-nums text-orange-500">
                            {company.platform_fee_percent ?? overview?.platform_fee_percent ?? 5}%
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
                        onClick={() => handleEnterTenant(company)}
                      >
                        <DoorOpen className="w-3.5 h-3.5 mr-1.5" />
                        Enter tenant
                      </Button>
                    </div>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <div className="pos-product-card text-center text-sm text-muted-foreground py-10">
                      No tenants match this filter
                    </div>
                  )}
                </div>

                <div className="hidden md:block data-table-wrap bg-card rounded-2xl overflow-hidden">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Contact</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Renewal</th>
                        <th>Fee</th>
                        <th>Paystack</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company) => (
                        <tr key={company.id} className="border-t border-border hover:bg-secondary/40">
                          <td className="px-3 py-3">
                            <p className="font-semibold">{company.name}</p>
                            {company.location && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                                {company.location}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 font-mono">
                              {company.id.slice(-8)}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <div className="space-y-1 max-w-[200px]">
                              {(company.contact_phone || company.phone) && (
                                <a
                                  href={`tel:${company.contact_phone ?? company.phone}`}
                                  className="flex items-center gap-1.5 text-foreground/80 hover:text-primary"
                                >
                                  <Phone className="w-3 h-3 shrink-0" />
                                  <span className="truncate">
                                    {company.contact_phone ?? company.phone}
                                  </span>
                                </a>
                              )}
                              {(company.contact_email || company.admin_email) && (
                                <a
                                  href={`mailto:${company.contact_email ?? company.admin_email}`}
                                  className="flex items-center gap-1.5 text-foreground/80 hover:text-primary"
                                >
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">
                                    {company.contact_email ?? company.admin_email}
                                  </span>
                                </a>
                              )}
                              {!company.contact_phone &&
                                !company.phone &&
                                !company.contact_email &&
                                !company.admin_email && (
                                  <span className="text-muted-foreground">—</span>
                                )}
                            </div>
                          </td>
                          <td className="px-3 py-3">{planBadge(company.plan)}</td>
                          <td className="px-3 py-3">
                            {statusBadge(
                              company.subscription.access === 'warning'
                                ? 'renewal soon'
                                : company.status,
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <p>{formatDate(company.plan_renewal_at)}</p>
                            {company.subscription.days_until_renewal != null &&
                              company.subscription.days_until_renewal > 0 && (
                                <p className="text-muted-foreground">
                                  {company.subscription.days_until_renewal}d left
                                </p>
                              )}
                          </td>
                          <td className="px-3 py-3 tabular-nums font-bold text-orange-500">
                            {company.platform_fee_percent ?? overview?.platform_fee_percent ?? 5}%
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-[11px] capitalize text-muted-foreground">
                              {company.paystack_subaccount_status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              ref={(el) => {
                                menuButtonRefs.current[company.id] = el;
                              }}
                              onClick={() => toggleActionsMenu(company.id)}
                              className="p-2 rounded-xl hover:bg-secondary"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredCompanies.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                            No tenants match this filter
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'analytics' && analytics && (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: 'Online orders (30d)', value: analytics.totals.online_orders_30d, money: false },
                    {
                      label: 'Online revenue (30d)',
                      value: formatCurrency(analytics.totals.online_revenue_30d),
                      money: true,
                    },
                    {
                      label: 'Platform fees (30d)',
                      value: formatCurrency(analytics.totals.platform_fees_30d),
                      money: true,
                    },
                    {
                      label: 'POS sales (30d)',
                      value: formatCurrency(analytics.totals.pos_sales_30d),
                      money: true,
                    },
                  ].map(({ label, value, money }) => (
                    <div key={label} className="pos-product-card">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p
                        className={`text-2xl font-extrabold tabular-nums mt-2 ${
                          money ? 'text-orange-500' : 'text-foreground'
                        }`}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="pos-product-card !p-5">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Plan breakdown
                    </h3>
                    <div className="space-y-2">
                      {analytics.plan_breakdown.map((p) => (
                        <div key={p.plan} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{formatPlanLabel(p.plan)}</span>
                          <span className="font-bold tabular-nums">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pos-product-card !p-5">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-orange-500" /> Status breakdown
                    </h3>
                    <div className="space-y-2">
                      {analytics.status_breakdown.map((s) => (
                        <div key={s.status} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-muted-foreground">{s.status}</span>
                          <span className="font-bold tabular-nums">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pos-product-card !p-5">
                  <h3 className="font-bold mb-4">Top companies by online revenue (30d)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="pb-2 pr-4">Company</th>
                          <th className="pb-2 pr-4">Online</th>
                          <th className="pb-2 pr-4">POS</th>
                          <th className="pb-2 pr-4">Fees</th>
                          <th className="pb-2">Paystack</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.top_companies.map((c) => (
                          <tr key={c.company_id} className="border-b border-border/60">
                            <td className="py-2.5 pr-4 font-semibold">{c.name}</td>
                            <td className="py-2.5 pr-4 tabular-nums font-bold text-orange-500">
                              {formatCurrency(c.online_revenue)}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums">{formatCurrency(c.pos_revenue)}</td>
                            <td className="py-2.5 pr-4 tabular-nums text-emerald-600 font-semibold">
                              {formatCurrency(c.platform_fees)}
                            </td>
                            <td className="py-2.5 capitalize text-muted-foreground">{c.paystack_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-xl space-y-4">
                <div className="pos-product-card !p-5 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">Marketplace platform fee</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Default percentage kept from each Paystack online order. Override per company
                        when needed.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Default fee (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={platformFee}
                      onChange={(e) => setPlatformFee(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="pos-product-card !p-5 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">Renewal support contact</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Shown to tenants when their subscription is expiring or locked.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Support email *
                    </label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="billing@yourplatform.com"
                      className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Support phone (optional)
                    </label>
                    <input
                      type="tel"
                      value={supportPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      placeholder="+233 20 000 0000"
                      className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <Button
                    onClick={() => void savePlatformSettings()}
                    loading={savingSettings}
                    fullWidth
                    className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl h-12 font-bold"
                  >
                    Save platform settings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {openMenuId &&
        menuPos &&
        createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            className="fixed z-[200] min-w-[200px] rounded-2xl border border-border bg-card shadow-xl py-1 text-left"
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
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-secondary flex items-center gap-2 text-orange-600 font-semibold"
                    onClick={() => handleEnterTenant(company)}
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    Enter tenant
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-secondary"
                    onClick={() => openEdit(company)}
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-secondary"
                    onClick={() => void handleExtend(company)}
                  >
                    Renew plan
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-secondary"
                    onClick={() => void handleToggleStatus(company)}
                  >
                    {company.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-500/10"
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
          <Input
            label="Company name *"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
            <Input
              label="Location"
              value={companyLocation}
              onChange={(e) => setCompanyLocation(e.target.value)}
            />
          </div>
          <Select label="Plan" value={plan} onChange={setPlan} options={PLAN_OPTIONS} />
          <Input
            label="Admin name *"
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
            required
          />
          <Input
            label="Admin email *"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
          />
          <Input
            label="Admin password *"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            minLength={8}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-orange-500 hover:bg-orange-600 text-white">
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Update company" size="lg">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input label="Company name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Input
              label="Location"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
            />
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
          <Input
            label="Platform fee override (%)"
            type="number"
            value={editFee}
            onChange={(e) => setEditFee(e.target.value)}
            placeholder="Leave empty for default"
          />
          <Input
            label="Renewal date"
            type="date"
            value={editRenewal}
            onChange={(e) => setEditRenewal(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SuperAdminDashboard;
