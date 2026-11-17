import React from 'react';
import { Link } from 'react-router-dom';
import { AccountSectionLayout } from '../../../components/shop/AccountSectionLayout';
import { CustomerInboxList } from '../../../components/shop/CustomerInboxList';
import { useCustomerSession } from '../../../hooks/shop/useCustomerSession';
import { Button } from '../../../components/Button';

export const AccountInboxPage: React.FC = () => {
  const { loading, signedIn } = useCustomerSession();

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to view your inbox.</p>
        <Link to="/auth/login?redirect=/account/inbox">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>;
  }

  return (
    <AccountSectionLayout
      title="Inbox"
      subtitle="Encrypted conversations with sellers"
    >
      <CustomerInboxList />
    </AccountSectionLayout>
  );
};
