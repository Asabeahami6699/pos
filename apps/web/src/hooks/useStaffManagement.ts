// hooks/useStaffManagement.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { api } from '../lib/api';

export interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company_id: string;
  sales_type?: 'retail' | 'wholesale' | 'both';
  phone?: string;
  address?: string;
  // Branch info from join
  branch_id?: string;
  branch_name?: string;
  branch_sales_type?: 'retail' | 'wholesale' | 'both';
}

interface NewStaffData {
  fullName: string;
  email: string;
  password: string;
  branchId: string;
  sales_type: 'retail' | 'wholesale' | 'both';
  phone: string;
  address: string;
}

export const useStaffManagement = (companyId: string | null) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingIds, setRemovingIds] = useState<string[]>([]);

  const fetchStaff = useCallback(async (companyId: string) => {
    try {
      // Fetch users with branch info using join
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          branch_staff!left (
            branch_id,
            branches!inner (
              id,
              name,
              sales_type
            )
          )
        `)
        .eq('company_id', companyId)
        .eq('role', 'salesperson')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setStaff([]);
        return;
      }

      // Transform the data to flatten the nested structure
      const staffWithBranch = data.map(user => {
        const branchStaff = user.branch_staff?.[0]; // Get first branch assignment
        const branch = branchStaff?.branches;
        
        return {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          company_id: user.company_id,
          sales_type: user.sales_type,
          phone: user.phone,
          address: user.address,
          branch_id: branch?.id,
          branch_name: branch?.name,
          branch_sales_type: branch?.sales_type
        };
      });

      setStaff(staffWithBranch);
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      toast.error('Staff Fetch Error', {
        description: error.message || 'Failed to fetch staff members'
      });
    }
  }, []);

  const handleAddStaff = useCallback(async (
    newStaff: NewStaffData,
    branches: any[]
  ) => {
    if (!companyId || !newStaff.branchId) {
      toast.warning('Missing Information', {
        description: 'Please fill in all required fields'
      });
      return false;
    }

    // ✅ Check if sales type matches branch sales type
    const selectedBranch = branches.find(b => b.id === newStaff.branchId);
    if (selectedBranch && selectedBranch.sales_type !== newStaff.sales_type) {
      toast.error('Sales Type Mismatch', {
        description: `Selected branch (${selectedBranch.name}) only allows ${selectedBranch.sales_type} sales. Please adjust the sales type to match.`
      });
      return false;
    }

    const toastId = toast.loading('Creating staff account...');
    setLoading(true);
    
    try {
      await api.createStaff({
        companyId,
        branchId: newStaff.branchId,
        fullName: newStaff.fullName,
        email: newStaff.email,
        password: newStaff.password,
        sales_type: newStaff.sales_type,
      });

      toast.success('Staff Member Created', {
        description: `${newStaff.fullName} has been added to your team`,
        id: toastId
      });
      
      await fetchStaff(companyId);
      return true;
    } catch (error: any) {
      console.error('Staff creation error:', error);
      toast.error('Staff Creation Failed', {
        description: error.message || 'Failed to create staff account',
        id: toastId
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchStaff]);

  const handleEditStaff = useCallback(async (
  editingStaff: StaffMember | null,
  branches: any[]
) => {
  if (!editingStaff || !companyId) return false;

  // Auto-sync sales type to match the assigned branch
  let resolvedSalesType = editingStaff.sales_type;
  if (editingStaff.branch_id) {
    const assignedBranch = branches.find(b => b.id === editingStaff.branch_id);
    if (assignedBranch) {
      resolvedSalesType = assignedBranch.sales_type;
    }
  }

  const toastId = toast.loading('Updating staff...');

  try {
    // 1. Update user record — always use resolvedSalesType to stay in sync with branch
    const { error: userError } = await supabase
      .from('users')
      .update({
        full_name: editingStaff.full_name,
        sales_type: resolvedSalesType,
        phone: editingStaff.phone,
        address: editingStaff.address
      })
      .eq('id', editingStaff.id);

    if (userError) throw userError;

    // 2. Update branch assignment
    if (editingStaff.branch_id) {
      // Check if there's an existing branch assignment
      const { data: existingAssignment } = await supabase
        .from('branch_staff')
        .select('*')
        .eq('user_id', editingStaff.id)
        .single();

      if (existingAssignment) {
        // Update existing assignment
        const { error: updateError } = await supabase
          .from('branch_staff')
          .update({
            branch_id: editingStaff.branch_id
          })
          .eq('user_id', editingStaff.id);

        if (updateError) throw updateError;
      } else {
        // Insert new assignment
        const { error: insertError } = await supabase
          .from('branch_staff')
          .insert({
            user_id: editingStaff.id,
            branch_id: editingStaff.branch_id
          });

        if (insertError) throw insertError;
      }
    } else {
      // Remove branch assignment if unassigned
      const { error: deleteError } = await supabase
        .from('branch_staff')
        .delete()
        .eq('user_id', editingStaff.id);

      if (deleteError) throw deleteError;
    }

    toast.success('Staff Updated', {
      description: `${editingStaff.full_name} has been updated`,
      id: toastId
    });

    // 3. Fetch updated staff list
    await fetchStaff(companyId);
    return true;
  } catch (error: any) {
    console.error('Edit staff error:', error);
    toast.error('Update Failed', {
      description: error.message || 'Failed to update staff',
      id: toastId
    });
    return false;
  }
}, [companyId, fetchStaff]);

  const handleRemoveStaff = useCallback(async (
    userId: string,
    userName: string
  ) => {
    if (!companyId) return false;
    
    setRemovingIds(prev => [...prev, userId]);
    
    try {
      // 1. Remove branch assignment (if any)
      const { error: branchError } = await supabase
        .from('branch_staff')
        .delete()
        .eq('user_id', userId);
      
      if (branchError) {
        console.error('Branch removal error:', branchError);
        // Continue anyway - maybe there was no branch assignment
      }
      
      // 2. Delete the user record
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (userError) throw userError;
      
      // 3. Also delete from auth.users if possible (requires admin privileges)
      // Note: This requires admin privileges and might not be available
      // We'll skip this for now and just remove from public.users
      
      // 4. Update local state immediately for live update
      setStaff(prev => prev.filter(member => member.id !== userId));
      
      toast.success('Staff Removed', {
        description: `${userName} has been removed from your team`
      });
      
      // 5. Refetch to ensure consistency
      await fetchStaff(companyId);
      
      return true;
    } catch (error: any) {
      console.error('Remove staff error:', error);
      toast.error('Removal Failed', {
        description: error.message || 'Failed to remove staff member'
      });
      return false;
    } finally {
      setRemovingIds(prev => prev.filter(id => id !== userId));
    }
  }, [companyId, fetchStaff]);

  // Initial fetch
  useEffect(() => {
    if (companyId) {
      fetchStaff(companyId);
    }
  }, [companyId, fetchStaff]);

  return {
    // State
    staff,
    loading,
    removingIds,
    
    // Functions
    fetchStaff: () => companyId && fetchStaff(companyId),
    handleAddStaff,
    handleEditStaff,
    handleRemoveStaff,
    
    // State setters
    setStaff,
    setRemovingIds
  };
};