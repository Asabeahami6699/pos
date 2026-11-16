// src/components/ProtectedRoute.tsx
import React, { useCallback, useEffect, useState } from 'react';
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

  const resolveAccess = useCallback(
    async (userId: string | undefined) => {
      if (!userId) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single();

        if (error || !userData) {
          setAuthorized(false);
        } else {
          setAuthorized(allowedRoles.includes(userData.role as UserRole));
        }
      } catch (error) {
        console.error('Auth check error:', error);
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
      await resolveAccess(session?.user?.id);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setLoading(true);
      void resolveAccess(session?.user?.id);
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
