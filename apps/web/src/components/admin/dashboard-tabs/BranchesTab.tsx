import React from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { BranchCard } from '../BranchCard';
import { Button } from '../../Button';

interface BranchesTabProps {
  branches: any[];
  loading: boolean;
  setIsBranchModalOpen: (open: boolean) => void;
  handleDeleteBranch: (branchId: string) => void;
  setEditingBranch: (branch: any) => void;
  setIsEditBranchModalOpen: (open: boolean) => void;
  getSalesTypeLabel: (type: 'retail' | 'wholesale' | 'both') => string;
}

export const BranchesTab: React.FC<BranchesTabProps> = ({
  branches,
  loading,
  setIsBranchModalOpen,
  handleDeleteBranch,
  setEditingBranch,
  setIsEditBranchModalOpen,
  getSalesTypeLabel
}) => {
  return (
    <div className="flex flex-col h-full">  {/* Full height container */}
      <DashboardHeader
        title="Branch Management"
        subtitle="Manage your business locations and branch inventory"
        actionButton={{
          label: 'Add Branch',
          onClick: () => setIsBranchModalOpen(true),
        }}
        actionTourId="admin-branches-add"
      />

      <div className="flex-1 overflow-y-auto max-h-[70vh] pb-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                onEdit={(b) => {
                  setEditingBranch(b);
                  setIsEditBranchModalOpen(true);
                }}
                onDelete={handleDeleteBranch}
              />
            ))}

            {branches.length === 0 && (
              <div
                data-tour="admin-branches-empty"
                className="col-span-full text-center py-14 rounded-xl border border-dashed border-border bg-card/50"
              >
                <div className="text-4xl mb-4">🏢</div>
                <h3 className="text-lg font-medium text-foreground mb-2">No branches yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
                  Create your first retail or wholesale location so staff can sell and receive stock.
                </p>
                <Button variant="primary" onClick={() => setIsBranchModalOpen(true)}>
                  + Add First Branch
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};