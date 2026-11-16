import React, { useCallback, useEffect, useState } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { ThemeToggle } from '../../ThemeToggle';
import { Button } from '../../Button';
import { Input } from '../../Input';
import {
  BookOpen,
  Building2,
  ChevronRight,
  Headset,
  Loader2,
  MapPin,
  Monitor,
  Palette,
  Percent,
  Pencil,
  Save,
  Store,
  User,
  Wallet,
} from 'lucide-react';
import { PaystackPayoutSettings } from '../PaystackPayoutSettings';
import { CompanyProfileModal } from '../CompanyProfileModal';
import { api, type CompanySettings } from '../../../lib/api';
import { toast } from 'sonner';

export type SettingsSectionId =
  | 'settings-profile'
  | 'settings-pos'
  | 'settings-payments'
  | 'settings-appearance';

interface SettingsTabProps {
  companyId?: string;
  section?: SettingsSectionId | 'settings';
  onOpenGuide?: () => void;
  onReplayTour?: () => void;
  onInventoryModelChange?: (model: 'warehouse' | 'branch_only') => void;
}

function SettingsSection({
  icon,
  iconClass,
  title,
  description,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card p-4 md:p-5 flex flex-col h-full ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg shrink-0 ${iconClass}`}>{icon}</div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

const SECTION_META: Record<
  SettingsSectionId,
  { title: string; subtitle: string }
> = {
  'settings-profile': {
    title: 'Profile & store',
    subtitle: 'Admin details and marketplace branding',
  },
  'settings-pos': {
    title: 'POS & support',
    subtitle: 'Tax, discounts, and cashier help contacts',
  },
  'settings-payments': {
    title: 'Payments',
    subtitle: 'Paystack payout account for online orders',
  },
  'settings-appearance': {
    title: 'Appearance & help',
    subtitle: 'Theme preferences and walkthroughs',
  },
};

function resolveSection(section?: SettingsSectionId | 'settings'): SettingsSectionId {
  if (!section || section === 'settings') return 'settings-profile';
  return section;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  companyId,
  section = 'settings-profile',
  onOpenGuide,
  onReplayTour,
  onInventoryModelChange,
}) => {
  const activeSection = resolveSection(section);
  const meta = SECTION_META[activeSection];

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<CompanySettings | null>(null);
  const [posSaving, setPosSaving] = useState(false);

  const [taxRate, setTaxRate] = useState('16');
  const [discountsEnabled, setDiscountsEnabled] = useState(true);
  const [maxDiscount, setMaxDiscount] = useState('100');
  const [quickDiscounts, setQuickDiscounts] = useState('5, 10, 15');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  const applyPosFields = useCallback((data: CompanySettings) => {
    setTaxRate(String(data.company.tax_rate_percent ?? 16));
    setDiscountsEnabled(data.company.pos_discounts_enabled !== false);
    setMaxDiscount(String(data.company.pos_max_discount_percent ?? 100));
    setQuickDiscounts((data.company.pos_quick_discounts ?? [5, 10, 15]).join(', '));
    setSupportPhone(data.company.support_phone ?? '');
    setSupportEmail(data.company.support_email ?? '');
  }, []);

  const loadProfileSummary = useCallback(async () => {
    if (!companyId) return;
    setProfileLoading(true);
    try {
      const res = await api.getCompanySettings();
      setProfile(res.data);
      applyPosFields(res.data);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [companyId, applyPosFields]);

  useEffect(() => {
    if (
      activeSection === 'settings-profile' ||
      activeSection === 'settings-pos'
    ) {
      void loadProfileSummary();
    }
  }, [loadProfileSummary, activeSection]);

  const handleProfileSaved = (data: CompanySettings) => {
    setProfile(data);
    applyPosFields(data);
    onInventoryModelChange?.(data.company.inventory_model ?? 'warehouse');
  };

  const parseQuickDiscountList = (raw: string): number[] => {
    const nums = raw
      .split(/[, ]+/)
      .map((p) => Number(p.trim()))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
    return Array.from(new Set(nums)).slice(0, 8);
  };

  const handleSavePosSettings = async () => {
    const tax = Number(taxRate);
    const max = Number(maxDiscount);
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      toast.error('Tax rate must be between 0 and 100');
      return;
    }
    if (!Number.isFinite(max) || max < 0 || max > 100) {
      toast.error('Max discount must be between 0 and 100');
      return;
    }
    const presets = parseQuickDiscountList(quickDiscounts);
    if (quickDiscounts.trim() && presets.length === 0) {
      toast.error('Quick discounts must be numbers like 5, 10, 15');
      return;
    }

    setPosSaving(true);
    try {
      const res = await api.updateCompanySettings({
        tax_rate_percent: tax,
        pos_discounts_enabled: discountsEnabled,
        pos_max_discount_percent: max,
        pos_quick_discounts: presets.length ? presets : [5, 10, 15],
        support_phone: supportPhone.trim() || null,
        support_email: supportEmail.trim() || null,
      });
      setProfile(res.data);
      applyPosFields(res.data);
      toast.success('POS & support settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setPosSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <DashboardHeader title={meta.title} subtitle={meta.subtitle} />

      {activeSection === 'settings-profile' && companyId && (
        <>
          <SettingsSection
            icon={<User className="w-4 h-4" />}
            iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            title="Profile & store branding"
            description="Your admin details and how your store appears on the marketplace."
          >
            {profileLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : profile ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {profile.company.logo_url ? (
                      <img
                        src={profile.company.logo_url}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {profile.company.name || 'Your store'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {profile.user.full_name}
                        {profile.user.email ? ` · ${profile.user.email}` : ''}
                      </p>
                      {profile.company.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {profile.company.location}
                        </p>
                      )}
                    </div>
                  </div>
                  {profile.company.banner_url && (
                    <div className="h-14 w-full sm:w-40 rounded-lg overflow-hidden border border-border shrink-0">
                      <img
                        src={profile.company.banner_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 shrink-0" />
                    Logo and banner show on marketplace store pages
                  </li>
                  <li className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    Update your name, phone, and address anytime
                  </li>
                </ul>

                <Button type="button" onClick={() => setProfileOpen(true)} className="w-full sm:w-auto">
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Edit profile & store
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Could not load profile. Try again.</p>
                <Button type="button" variant="secondary" size="sm" onClick={loadProfileSummary}>
                  Retry
                </Button>
              </div>
            )}
          </SettingsSection>

          <CompanyProfileModal
            isOpen={profileOpen}
            onClose={() => setProfileOpen(false)}
            companyId={companyId}
            onSaved={handleProfileSaved}
          />
        </>
      )}

      {activeSection === 'settings-pos' && companyId && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingsSection
              icon={<Percent className="w-4 h-4" />}
              iconClass="bg-orange-500/10 text-orange-600"
              title="Tax & discounts"
              description="Controls what cashiers see on the POS cart."
            >
              {profileLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Sales tax rate (%)"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={discountsEnabled}
                      onChange={(e) => setDiscountsEnabled(e.target.checked)}
                      className="rounded border-border"
                    />
                    Allow discounts on POS
                  </label>
                  <Input
                    label="Max cart discount (%)"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    disabled={!discountsEnabled}
                  />
                  <Input
                    label="Quick discount chips"
                    placeholder="5, 10, 15"
                    value={quickDiscounts}
                    onChange={(e) => setQuickDiscounts(e.target.value)}
                    disabled={!discountsEnabled}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Comma-separated percents shown as one-tap item discounts.
                  </p>
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              icon={<Headset className="w-4 h-4" />}
              iconClass="bg-emerald-500/10 text-emerald-600"
              title="Support line"
              description="Shown to sales staff in the POS sidebar Need Help? area."
            >
              {profileLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Support phone"
                    placeholder="+233…"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                  />
                  <Input
                    label="Support email"
                    type="email"
                    placeholder="support@yourstore.com"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                  />
                </div>
              )}
            </SettingsSection>
          </div>
          {!profileLoading && (
            <Button
              type="button"
              onClick={() => void handleSavePosSettings()}
              loading={posSaving}
              className="w-full sm:w-auto"
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save POS & support
            </Button>
          )}
        </div>
      )}

      {activeSection === 'settings-payments' && companyId && (
        <div>
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Wallet className="w-3.5 h-3.5" />
            Paystack payouts
          </div>
          <PaystackPayoutSettings companyId={companyId} />
        </div>
      )}

      {activeSection === 'settings-appearance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsSection
            icon={<Palette className="w-4 h-4" />}
            iconClass="bg-primary/10 text-primary"
            title="Appearance"
            description="Light or dark mode for the dashboard."
          >
            <ThemeToggle showLabel />
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span>Saved on this device only.</span>
            </div>
          </SettingsSection>

          {(onOpenGuide || onReplayTour) && (
            <SettingsSection
              icon={<BookOpen className="w-4 h-4" />}
              iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
              title="Help & walkthrough"
              description="Inventory, warehouse, staff, and the first-time setup tour."
            >
              <div className="flex flex-wrap gap-2">
                {onOpenGuide && (
                  <Button variant="secondary" size="sm" onClick={onOpenGuide} className="group">
                    Open user guide
                    <ChevronRight className="w-4 h-4 ml-1 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                )}
                {onReplayTour && (
                  <Button variant="outline" size="sm" onClick={onReplayTour}>
                    Replay setup tour
                  </Button>
                )}
              </div>
            </SettingsSection>
          )}
        </div>
      )}

      {!companyId && activeSection !== 'settings-appearance' && (
        <div className="glass-card p-6 text-sm text-muted-foreground">
          Select a company context to manage this settings section.
        </div>
      )}
    </div>
  );
};
