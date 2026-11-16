// components/StaffTab.tsx
import React, { useState } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { Select } from '../../Select';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';

interface StaffTabProps {
  staff: any[];
  loading: boolean;
  branches: any[];
  setIsStaffModalOpen: (open: boolean) => void;
  setEditingStaff: (staff: any) => void;
  setIsEditStaffModalOpen: (open: boolean) => void;
  toast: typeof toast;
  companyId: string;
  fetchStaff: () => Promise<void>;
  getSalesTypeLabel: (type: 'retail' | 'wholesale' | 'both') => string;
  handleRemoveStaff?: (userId: string, userName: string) => Promise<boolean>;
  removingIds?: string[];
}

export const StaffTab: React.FC<StaffTabProps> = ({
  staff,
  loading,
  branches,
  setIsStaffModalOpen,
  setEditingStaff,
  setIsEditStaffModalOpen,
  toast,
  companyId,
  fetchStaff,
  getSalesTypeLabel,
  handleRemoveStaff,
  removingIds = []
}) => {
  const [assigningStaff, setAssigningStaff] = useState<string | null>(null);
  const [localRemovingIds, setLocalRemovingIds] = useState<string[]>([]);

  const handleStaffAssignment = async (userId: string, branchId: string) => {
    try {
      setAssigningStaff(userId);
      
      const currentStaff = staff.find(s => s.id === userId);
      if (!currentStaff) return;

      if (branchId) {
        // Get branch info
        const branch = branches.find(b => b.id === branchId);
        const branchSalesType = branch?.sales_type || 'retail';
        
        // Auto-update user's sales type to match branch
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            sales_type: branchSalesType
          })
          .eq('id', userId);
        
        if (updateError) throw updateError;
        
        // Check if there's an existing branch assignment
        const { data: existingAssignment } = await supabase
          .from('branch_staff')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (existingAssignment) {
          // Update existing assignment
          const { error: updateAssignError } = await supabase
            .from('branch_staff')
            .update({
              branch_id: branchId
            })
            .eq('user_id', userId);
          
          if (updateAssignError) throw updateAssignError;
        } else {
          // Insert new assignment
          const { error: insertError } = await supabase
            .from('branch_staff')
            .insert({
              user_id: userId,
              branch_id: branchId
            });
          
          if (insertError) throw insertError;
        }
        
        toast.success('Staff Assigned', {
          description: `Staff assigned to ${branch?.name}. Sales type updated to ${getSalesTypeLabel(branchSalesType)}.`
        });
      } else {
        // Unassign from branch
        if (currentStaff.branch_id) {
          const { error: deleteError } = await supabase
            .from('branch_staff')
            .delete()
            .eq('user_id', userId);
          
          if (deleteError) throw deleteError;

          // Reset sales type to default when unassigned
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              sales_type: 'retail'
            })
            .eq('id', userId);
          
          if (updateError) throw updateError;
          
          toast.success('Staff Unassigned', {
            description: 'Staff member removed from branch. Sales type reset to Retail.'
          });
        }
      }
      
      // Trigger live update
      await fetchStaff();
    } catch (error: any) {
      console.error('Assignment error:', error);
      toast.error('Assignment Failed', {
        description: error.message || 'Failed to assign staff'
      });
    } finally {
      setAssigningStaff(null);
    }
  };

  const handleRemoveStaffClick = async (userId: string, userName: string) => {
    // Track removal locally
    setLocalRemovingIds(prev => [...prev, userId]);
    
    try {
      if (handleRemoveStaff) {
        // Use the hook's handleRemoveStaff if provided
        const success = await handleRemoveStaff(userId, userName);
        if (!success) {
          // If removal failed, remove from local tracking
          setLocalRemovingIds(prev => prev.filter(id => id !== userId));
        }
      } else {
        // Fallback to local implementation
        // Remove from branch_staff first
        const { error: branchError } = await supabase
          .from('branch_staff')
          .delete()
          .eq('user_id', userId);
        
        if (branchError) throw branchError;
        
        // Then delete user
        const { error: userError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);
        
        if (userError) throw userError;
        
        toast.success('Staff Removed', {
          description: `${userName} has been removed`
        });
        
        // Wait a bit before refetching to ensure deletion is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Live update by refetching
        await fetchStaff();
      }
    } catch (error: any) {
      console.error('Remove error:', error);
      toast.error('Removal Failed', {
        description: error.message || 'Failed to remove staff'
      });
      // Remove from local tracking if error
      setLocalRemovingIds(prev => prev.filter(id => id !== userId));
    }
  };

  const handleEditStaffClick = (staffMember: any) => {
    setEditingStaff(staffMember);
    setIsEditStaffModalOpen(true);
  };

  // Combine removing IDs from props and local state
  const allRemovingIds = [...removingIds, ...localRemovingIds];

  return (
    <div>
      <DashboardHeader
        title="Staff Management"
        subtitle="Manage your sales team and assignments"
        actionButton={{
          label: 'Add Staff',
          onClick: () => setIsStaffModalOpen(true),
        }}
        actionTourId="admin-staff"
      />
      
      {loading && staff.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div 
            className={`overflow-x-auto ${
              staff.length > 5 
                ? 'max-h-[500px] overflow-y-auto' 
                : ''
            }`}
          >
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-secondary/60 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Staff Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sales Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Assigned Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {staff.map(member => {
                  const assignedBranch = branches.find(b => b.id === member.branch_id);
                  const salesTypeMatch = assignedBranch && assignedBranch.sales_type === member.sales_type;
                  const isAssigning = assigningStaff === member.id;
                  const isRemoving = allRemovingIds.includes(member.id);
                  
                  // If staff is being removed, show a faded row
                  if (isRemoving) {
                    return (
                      <tr key={member.id} className="bg-secondary/60 opacity-50">
                        <td colSpan={6} className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500 mr-2"></div>
                            Removing {member.full_name || 'staff member'}...
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  
                  return (
                    <tr key={member.id} className="hover:bg-secondary/60">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-indigo-500/15 rounded-full flex items-center justify-center mr-3">
                            <span className="text-indigo-600 font-medium">
                              {member.full_name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {member.full_name || 'Unnamed User'}
                            </div>
                            <div className="text-sm text-muted-foreground">Salesperson</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-foreground">{member.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-foreground">{member.phone || 'Not provided'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.sales_type === 'wholesale' ? 'bg-blue-500/15 text-blue-800' :
                            member.sales_type === 'both' ? 'bg-purple-500/15 text-purple-800' :
                            'bg-secondary text-foreground'
                          }`}>
                            {getSalesTypeLabel(member.sales_type || 'retail')}
                          </span>
                          {assignedBranch && salesTypeMatch && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Matches
                            </span>
                          )}
                          {assignedBranch && !salesTypeMatch && (
                            <span className="text-xs text-orange-600 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Mismatch
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <Select
                            value={member.branch_id || ''}
                            onChange={(value) => handleStaffAssignment(member.id, value)}
                            options={[
                              { value: '', label: 'Unassigned' },
                              ...branches.map(b => ({ 
                                value: b.id, 
                                label: `${b.name} (${getSalesTypeLabel(b.sales_type)})` 
                              }))
                            ]}
                            disabled={isAssigning || isRemoving}
                          />
                          {isAssigning && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                            </div>
                          )}
                        </div>
                        {assignedBranch && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {getSalesTypeLabel(assignedBranch.sales_type)} sales
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditStaffClick(member)}
                          disabled={isAssigning || isRemoving}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveStaffClick(member.id, member.full_name || 'Staff member')}
                          disabled={isAssigning || isRemoving}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                
                {staff.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-4xl mb-4">👤</div>
                      <h3 className="text-lg font-medium text-foreground mb-2">No staff members yet</h3>
                      <p className="text-muted-foreground mb-6">Add your first salesperson to get started</p>
                      <Button
                        variant="primary"
                        onClick={() => setIsStaffModalOpen(true)}
                      >
                        + Add First Staff Member
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {staff.length > 0 && (
            <div className="bg-secondary/60 px-6 py-3 border-t border-border">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Showing <span className="font-medium">{staff.length}</span> staff member{staff.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-4">
                  {staff.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      Scroll within table to see more rows
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-green-600">✓</span>
                      <span className="text-xs">Sales type matches branch</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-orange-600">⚠</span>
                      <span className="text-xs">Sales type mismatch</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};