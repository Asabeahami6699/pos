import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getHomePathForRole } from '../../lib/roleRedirect';
import type { UserRole } from '../../types';
import { MarketplacePage } from '../../pages/shop/MarketplacePage';

/**
 * Marketplace home: guests and customers see the shop.
 * Logged-in staff are sent to their role dashboard.
 */
export const MarketplaceLanding: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role && profile.role !== 'customer') {
        setRedirectTo(getHomePathForRole(profile.role as UserRole));
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground animate-pulse">Loading…</div>
    );
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <MarketplacePage />;
};
