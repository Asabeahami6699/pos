import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, ImageIcon, Loader2, Save, Store, User } from 'lucide-react';
import { api, type CompanySettings } from '../../lib/api';
import { uploadCompanyBranding } from '../../lib/companyBrandingUpload';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { toast } from 'sonner';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onSaved?: (data: CompanySettings) => void;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  companyId,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [inventoryModel, setInventoryModel] = useState<'warehouse' | 'branch_only'>('warehouse');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const applySettings = useCallback((data: CompanySettings) => {
    setFullName(data.user.full_name ?? '');
    setEmail(data.user.email ?? '');
    setPhone(data.user.phone ?? '');
    setAddress(data.user.address ?? '');
    setCompanyName(data.company.name ?? '');
    setCompanyPhone(data.company.phone ?? '');
    setCompanyLocation(data.company.location ?? '');
    setLogoUrl(data.company.logo_url);
    setBannerUrl(data.company.banner_url);
    setInventoryModel(data.company.inventory_model ?? 'warehouse');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCompanySettings();
      applySettings(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    if (isOpen && companyId) load();
  }, [isOpen, companyId, load]);

  const handleBrandingUpload = async (file: File, kind: 'logo' | 'banner') => {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingBanner;
    setUploading(true);
    try {
      const url = await uploadCompanyBranding(file, companyId, kind);
      if (kind === 'logo') setLogoUrl(url);
      else setBannerUrl(url);
      toast.success(kind === 'logo' ? 'Logo uploaded' : 'Banner uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateCompanySettings({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        company_name: companyName.trim(),
        company_phone: companyPhone.trim() || null,
        company_location: companyLocation.trim() || null,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        inventory_model: inventoryModel,
      });
      applySettings(res.data);
      onSaved?.(res.data);
      toast.success('Profile and store updated');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile & store branding"
      size="xl"
      scrollable
      footer={
        <div className="flex justify-end w-full gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="company-profile-form" loading={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            Save changes
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <form id="company-profile-form" onSubmit={handleSave} className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Your account
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input label="Email" type="email" value={email} readOnly disabled className="bg-secondary/60" />
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Marketplace store
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Name, location, logo, and banner appear on your public store page.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Store name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
              <Input
                label="Store phone"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
              />
              <Input
                label="Location"
                value={companyLocation}
                onChange={(e) => setCompanyLocation(e.target.value)}
                className="sm:col-span-2"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Store banner</p>
                <p className="text-xs text-muted-foreground mb-2">Wide header on your store page (≈1200×400px).</p>
                <div className="relative rounded-xl overflow-hidden border border-border bg-secondary/40 aspect-[3/1] max-h-36">
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-1">
                      <ImageIcon className="w-7 h-7 opacity-40" />
                      <span className="text-xs">No banner</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleBrandingUpload(file, 'banner');
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={uploadingBanner}
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    {bannerUrl ? 'Change banner' : 'Upload banner'}
                  </Button>
                  {bannerUrl && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setBannerUrl(null)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-1">Store logo</p>
                <p className="text-xs text-muted-foreground mb-2">Square image on store listings (≈256×256px).</p>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl border border-border bg-secondary/40 overflow-hidden flex items-center justify-center shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleBrandingUpload(file, 'logo');
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={uploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoUrl ? 'Change logo' : 'Upload logo'}
                    </Button>
                    {logoUrl && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => setLogoUrl(null)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Store className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              Inventory model
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Choose how stock is tracked. Branch-only companies sell from branch stock on the marketplace; warehouse companies use a central warehouse.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                  inventoryModel === 'warehouse'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-secondary/40'
                }`}
              >
                <input
                  type="radio"
                  name="inventory_model"
                  className="mt-1"
                  checked={inventoryModel === 'warehouse'}
                  onChange={() => setInventoryModel('warehouse')}
                />
                <span>
                  <span className="text-sm font-medium block">Central warehouse</span>
                  <span className="text-xs text-muted-foreground">
                    Stock in warehouse, allocate to branches
                  </span>
                </span>
              </label>
              <label
                className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                  inventoryModel === 'branch_only'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-secondary/40'
                }`}
              >
                <input
                  type="radio"
                  name="inventory_model"
                  className="mt-1"
                  checked={inventoryModel === 'branch_only'}
                  onChange={() => setInventoryModel('branch_only')}
                />
                <span>
                  <span className="text-sm font-medium block">Branches only</span>
                  <span className="text-xs text-muted-foreground">
                    No warehouse — stock lives at branches
                  </span>
                </span>
              </label>
            </div>
          </section>
        </form>
      )}
    </Modal>
  );
};
