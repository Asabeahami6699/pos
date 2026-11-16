import React from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import type { StaffMember } from '../../hooks/useStaffManagement';

interface EditStaffModalProps {
  isOpen: boolean;
  editingStaff: StaffMember | null;
  setEditingStaff: (staff: StaffMember | null) => void;
  branches: any[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  getSalesTypeLabel: (type: 'retail' | 'wholesale' | 'both') => string;
}

export const EditStaffModal: React.FC<EditStaffModalProps> = ({
  isOpen,
  editingStaff,
  setEditingStaff,
  branches,
  onSubmit,
  onClose,
  getSalesTypeLabel
}) => {
  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const branch = branches.find(b => b.id === val);
    setEditingStaff({
      ...editingStaff!,
      branch_id: val || undefined,
      sales_type: branch?.sales_type ?? editingStaff!.sales_type
    });
  };

  const handleClose = () => {
    setEditingStaff(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Staff Member">
      {editingStaff && (
        <form onSubmit={onSubmit} className="space-y-6">
          <Input
            label="Full Name"
            value={editingStaff.full_name || ''}
            onChange={e => setEditingStaff({ ...editingStaff, full_name: e.target.value })}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={editingStaff.email || ''}
            disabled
          />

          <Input
            label="Phone Number"
            value={editingStaff.phone || ''}
            onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
            placeholder="Optional"
          />

          <Input
            label="Address"
            value={editingStaff.address || ''}
            onChange={e => setEditingStaff({ ...editingStaff, address: e.target.value })}
            placeholder="Optional"
          />

          {/* Branch — drives sales type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Assigned Branch
            </label>
            <select
              value={editingStaff.branch_id || ''}
              onChange={handleBranchChange}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Unassigned</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({getSalesTypeLabel(b.sales_type)})
                </option>
              ))}
            </select>
          </div>

          {/* Sales Type — read-only, derived from branch */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Sales Type
            </label>
            <div className="w-full px-3 py-2 border border-border rounded-lg bg-secondary/60 flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                editingStaff.sales_type === 'wholesale' ? 'bg-blue-500/15 text-blue-800' :
                editingStaff.sales_type === 'both' ? 'bg-purple-500/15 text-purple-800' :
                'bg-secondary text-foreground'
              }`}>
                {getSalesTypeLabel(editingStaff.sales_type || 'retail')}
              </span>
              {editingStaff.branch_id && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Matches branch
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {editingStaff.branch_id
                ? 'Automatically set by the assigned branch'
                : 'Assign a branch to set the sales type'}
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              Update Staff
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};