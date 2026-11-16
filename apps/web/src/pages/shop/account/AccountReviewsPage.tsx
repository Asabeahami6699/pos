import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountSectionLayout } from '../../../components/shop/AccountSectionLayout';
import { useCustomerSession } from '../../../hooks/shop/useCustomerSession';
import { shopApi } from '../../../lib/shopApi';
import { Button } from '../../../components/Button';

export const AccountReviewsPage: React.FC = () => {
  const { loading, signedIn } = useCustomerSession();
  const [ratings, setRatings] = useState<
    Array<{ id: string; rating: number; comment: string | null; products?: { name: string } }>
  >([]);

  const load = useCallback(async () => {
    const res = await shopApi.getMyRatings();
    setRatings((res.data as typeof ratings) ?? []);
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to view your reviews.</p>
        <Link to="/auth/login?redirect=/account/reviews">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>;
  }

  return (
    <AccountSectionLayout title="My reviews">
      <div className="space-y-2">
        {ratings.length === 0 ? (
          <div className="glass-card p-6 text-center text-sm text-muted-foreground">
            No reviews yet. Rate products from your orders.
          </div>
        ) : (
          ratings.map((r) => (
            <div key={r.id} className="glass-card p-3 text-sm">
              <p className="font-medium">{r.products?.name ?? 'Product'}</p>
              <p className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
              {r.comment && <p className="text-xs text-muted-foreground mt-1">{r.comment}</p>}
            </div>
          ))
        )}
      </div>
    </AccountSectionLayout>
  );
};
