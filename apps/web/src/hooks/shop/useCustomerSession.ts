import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface CustomerProfile {
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

export function useCustomerSession() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setSignedIn(false);
        setUserId(null);
        setProfile(null);
        return;
      }

      const { data: row } = await supabase
        .from('users')
        .select('full_name, email, phone, address, role')
        .eq('id', session.user.id)
        .single();

      if (row?.role !== 'customer') {
        setSignedIn(false);
        setUserId(null);
        setProfile(null);
        return;
      }

      setSignedIn(true);
      setUserId(session.user.id);
      setProfile({
        fullName: row.full_name ?? '',
        email: row.email ?? session.user.email ?? '',
        phone: row.phone ?? '',
        address: row.address ?? '',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, signedIn, userId, profile, refresh };
}
