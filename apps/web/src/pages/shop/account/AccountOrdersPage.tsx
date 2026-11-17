import React from 'react';
import { Link } from 'react-router-dom';
import { AccountSectionLayout } from '../../../components/shop/AccountSectionLayout';
import { CustomerOrdersPanel } from '../../../components/shop/CustomerOrdersPanel';
import { useCustomerSession } from '../../../hooks/shop/useCustomerSession';
import { Button } from '../../../components/Button';

export const AccountOrdersPage: React.FC = () => {
  const { loading, signedIn } = useCustomerSession();

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to view your orders.</p>
        <Link to="/auth/login?redirect=/account/orders">
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
      title="My orders"
      subtitle="Select an order to review item quantities, totals, and tracking."
      wide
    >
      <CustomerOrdersPanel embedded />
    </AccountSectionLayout>
  );
};
