import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useTenantContextStore } from '../stores/tenantContextStore';

export type InventoryModel = 'warehouse' | 'branch_only';

export const useCompanyAuth = () => {
  const navigate = useNavigate();
  const actingTenant = useTenantContextStore((s) => s.actingTenant);
  const exitTenant = useTenantContextStore((s) => s.exitTenant);

  const [companyId, setCompanyId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [inventoryModel, setInventoryModel] = useState<InventoryModel>('warehouse');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isActingAsTenant, setIsActingAsTenant] = useState(false);

  const loadInventoryModel = async (id: string) => {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('inventory_model')
      .eq('id', id)
      .maybeSingle();

    setInventoryModel(
      companyRow?.inventory_model === 'branch_only' ? 'branch_only' : 'warehouse',
    );
  };

  const initSession = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate('/login');
        return null;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, company_id, role, full_name')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        navigate('/login');
        return null;
      }

      setUserId(userData.id);
      setUserRole(userData.role);
      setUserName(userData.full_name || 'Admin');

      // Super admin entering a tenant dashboard
      if (userData.role === 'super_admin') {
        const acting = useTenantContextStore.getState().actingTenant;
        if (acting?.id) {
          setCompanyId(acting.id);
          setIsActingAsTenant(true);
          await loadInventoryModel(acting.id);
          setInitialized(true);
          return acting.id;
        }
        setCompanyId('');
        setIsActingAsTenant(false);
        setInitialized(true);
        return null;
      }

      if (userData.company_id) {
        setCompanyId(userData.company_id);
        setIsActingAsTenant(false);
        await loadInventoryModel(userData.company_id);
        setInitialized(true);
        return userData.company_id;
      }

      setCompanyId('');
      setIsActingAsTenant(false);
      setInitialized(true);
      return null;
    } catch (error) {
      console.error('Initialization error:', error);
      toast.error('Initialization Error', {
        description: 'Failed to initialize dashboard',
      });
      navigate('/login');
      return null;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleLogout = async () => {
    try {
      exitTenant();
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error: unknown) {
      toast.error('Logout Failed', {
        description: error instanceof Error ? error.message : 'Failed to logout',
      });
      throw error;
    }
  };

  useEffect(() => {
    void initSession();
  }, [initSession, actingTenant?.id]);

  return {
    companyId,
    userId,
    userName,
    userRole,
    inventoryModel,
    loading: loading && !initialized,
    initialized,
    isActingAsTenant,
    handleLogout,
    refreshSession: initSession,
    setInventoryModel,
  };
};
