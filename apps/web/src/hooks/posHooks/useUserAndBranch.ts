import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { User, Branch } from '../../types/index';
import { toast } from 'sonner';
import { loadPosSession, savePosSession } from '../../lib/offline/sessionCache';
import { isOnline } from '../../lib/offline/network';

export const useUserAndBranch = () => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to store the abort controller for the current initialization sequence
  const abortControllerRef = useRef<AbortController | null>(null);

  const initPOS = async () => {
    // 1. Cancel any previous initialization
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      setLoading(true);
      setError(null);

      if (!isOnline()) {
        const cached = await loadPosSession();
        if (cached) {
          setUser(cached.user);
          setBranches(cached.branches);
          setSelectedBranch(cached.selectedBranch);
          toast.info('Offline mode', {
            description: `Using saved session for ${cached.selectedBranch.name}`,
          });
          return;
        }
        setError('No offline session. Log in once while online.');
        return;
      }

      // 2. Auth Check
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (signal.aborted) return;

      if (!authUser || authError) {
        // Don't navigate if aborted, to avoid routing errors on unmounted components
        if (!signal.aborted) navigate('/login');
        return;
      }

      // 3. User Check (Select or Insert)
      let userData: User | null = null;
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .abortSignal(signal) // Attach signal
        .single();

      if (signal.aborted) return;

      if (!existingUser) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.email?.split('@')[0] || 'Sales Staff',
            role: 'salesperson',
            sales_type: 'retail',
            company_id: null,
            created_at: new Date().toISOString()
          }])
          .abortSignal(signal) // Attach signal
          .select()
          .single();

        if (!createError) {
          userData = newUser as User;
        }
      } else {
        userData = existingUser as User;
      }

      if (signal.aborted) return;

      setUser(userData || { 
        id: authUser.id, 
        full_name: 'Sales Staff', 
        role: 'salesperson',
        sales_type: 'retail' 
      } as User);

      // 4. Branch Fetch
      const { data: staffData, error: staffError } = await supabase
        .from('branch_staff')
        .select(`
          branch_id, 
          branches!inner(*)
        `)
        .eq('user_id', authUser.id)
        .abortSignal(signal); // Attach signal

      if (signal.aborted) return;

      if (staffError) {
        console.error('Branch fetch error:', staffError);
        if (!signal.aborted) {
          setError('Failed to load your branch assignment');
          toast.error('Branch Error', {
            description: 'Failed to load your branch assignment'
          });
        }
        return;
      }

      if (staffData && staffData.length > 0) {
        const userBranches = staffData.map((item: any) => item.branches);
        setBranches(userBranches);
        
        if (userBranches.length > 0) {
          const userBranch = userBranches[0];
          setSelectedBranch(userBranch);

          const resolvedUser = userData || {
            id: authUser.id,
            full_name: 'Sales Staff',
            role: 'salesperson',
            sales_type: 'retail',
          } as User;

          await savePosSession({
            user: resolvedUser,
            branches: userBranches,
            selectedBranch: userBranch,
          });
          
          if (!signal.aborted) {
            toast.success('POS Initialized', {
              description: `Welcome to ${userBranch.name}!`,
              icon: '🏢'
            });
          }
        } else {
          if (!signal.aborted) {
            setError('You are not assigned to any branch. Please contact your Administrator.');
            toast.error('No Branch Assigned', {
              description: 'You are not assigned to any branch. Please contact administrator.'
            });
          }
        }
      } else {
        if (!signal.aborted) {
          setError('You are not assigned to any branch. Please contact your Administrator.');
          toast.error('No Branch Assigned', {
            description: 'You are not assigned to any branch. Please contact administrator.'
          });
        }
      }
    } catch (error: any) {
      // 5. Ignore AbortErrors, log others
      if (error.name !== 'AbortError') {
        console.error('Initialization error:', error);
        if (!signal.aborted) {
          setError('Failed to initialize POS. Please contact administrator.');
          toast.error('Initialization Failed', {
            description: 'Please contact administrator'
          });
        }
      }
    } finally {
      // Only set loading to false if not aborted
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    initPOS();

    // Cleanup: Abort pending requests when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    user,
    branches,
    selectedBranch,
    setSelectedBranch,
    loading,
    error
  };
};