// src/components/ProtectedRoute.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { STAFF_AUTH_PATH } from '../lib/roleRedirect';
import type { UserRole } from '../types/index';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const authorizedRef = useRef(false);

  const resolveAccess = useCallback(
    async (userId: string | undefined, options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;

      if (!userId) {
        authorizedRef.current = false;
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Only blank the tree on first gate check — never on token refresh / resume
      if (showLoading || !authorizedRef.current) {
        setLoading(true);
      }

      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single();

        if (error || !userData) {
          authorizedRef.current = false;
          setAuthorized(false);
        } else {
          const ok = allowedRoles.includes(userData.role as UserRole);
          authorizedRef.current = ok;
          setAuthorized(ok);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        authorizedRef.current = false;
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    },
    [allowedRoles],
  );

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      await resolveAccess(session?.user?.id, { showLoading: true });
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // Leaving the app / tab and coming back often refreshes the JWT.
      // Remounting children here wiped dashboard + add-product form state.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        authorizedRef.current = false;
        setAuthorized(false);
        setLoading(false);
        return;
      }

      void resolveAccess(session.user.id, {
        // Keep existing UI mounted while re-checking after SIGNED_IN etc.
        showLoading: !authorizedRef.current,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveAccess]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen page-shell">
        <div className="text-lg text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to={STAFF_AUTH_PATH} replace />;
  }

  return <>{children}</>;
};
