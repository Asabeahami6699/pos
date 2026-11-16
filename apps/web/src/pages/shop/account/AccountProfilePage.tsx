import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountSectionLayout } from '../../../components/shop/AccountSectionLayout';
import { useCustomerSession } from '../../../hooks/shop/useCustomerSession';
import { shopApi } from '../../../lib/shopApi';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { toast } from 'sonner';

export const AccountProfilePage: React.FC = () => {
  const { loading, signedIn, profile, refresh } = useCustomerSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setEmail(profile.email);
      setPhone(profile.phone);
      setAddress(profile.address);
    }
  }, [profile]);

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to view your profile.</p>
        <Link to="/auth/login?redirect=/account/profile">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>;
  }

  const saveProfile = async () => {
    try {
      await shopApi.updateProfile({ full_name: fullName, phone, address });
      toast.success('Profile updated');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <AccountSectionLayout title="Profile">
      <div className="glass-card p-4 space-y-3">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Email" value={email} readOnly className="opacity-70" />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Default address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Button onClick={saveProfile}>Save profile</Button>
      </div>
    </AccountSectionLayout>
  );
};
