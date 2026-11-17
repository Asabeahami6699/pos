import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountSectionLayout } from '../../../components/shop/AccountSectionLayout';
import { useCustomerSession } from '../../../hooks/shop/useCustomerSession';
import { shopApi, type CustomerAddress } from '../../../lib/shopApi';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { toast } from 'sonner';

export const AccountAddressesPage: React.FC = () => {
  const { loading, signedIn, profile } = useCustomerSession();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [newAddr, setNewAddr] = useState<Partial<CustomerAddress>>({ label: 'Home', address_line: '' });

  const load = useCallback(async () => {
    const res = await shopApi.getAddresses();
    setAddresses(res.data ?? []);
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to manage addresses.</p>
        <Link to="/auth/login?redirect=/account/addresses">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>;
  }

  const addAddress = async () => {
    if (!newAddr.address_line || newAddr.address_line.length < 5) {
      toast.error('Enter a valid address');
      return;
    }
    try {
      await shopApi.addAddress({
        label: newAddr.label ?? 'Home',
        full_name: profile?.fullName,
        phone: profile?.phone,
        address_line: newAddr.address_line,
        city: newAddr.city,
        region: newAddr.region,
        is_default: addresses.length === 0,
      });
      toast.success('Address saved');
      setNewAddr({ label: 'Home', address_line: '' });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save address');
    }
  };

  return (
    <AccountSectionLayout
      title="Addresses"
      subtitle="Delivery locations for checkout"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-3">
          {addresses.length === 0 ? (
            <div className="glass-card p-6 text-sm text-muted-foreground">
              No saved addresses yet.
            </div>
          ) : (
            addresses.map((a) => (
              <div key={a.id} className="glass-card p-4 text-sm">
                <p className="font-semibold">{a.label}</p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  {a.address_line}
                </p>
                {(a.city || a.region) && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {[a.city, a.region].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
        <div className="glass-card p-4 sm:p-5 space-y-3">
          <p className="text-sm font-semibold">Add address</p>
          <Input
            label="Label"
            value={newAddr.label ?? ''}
            onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
          />
          <Input
            label="Address"
            value={newAddr.address_line ?? ''}
            onChange={(e) => setNewAddr({ ...newAddr, address_line: e.target.value })}
          />
          <Button onClick={addAddress}>Save address</Button>
        </div>
      </div>
    </AccountSectionLayout>
  );
};
