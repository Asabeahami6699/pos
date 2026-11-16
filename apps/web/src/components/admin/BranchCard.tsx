import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';

interface BranchCardProps {
  branch: {
    id: string;
    name: string;
    created_at: string;
    staff_count?: number;
    product_count?: number;
    total_stock?: number;
  };
  onEdit: (branch: any) => void;
  onDelete: (id: string) => void;
}

export const BranchCard: React.FC<BranchCardProps> = ({ branch, onEdit, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    if (window.confirm(`Delete branch "${branch.name}"? This action cannot be undone.`)) {
      setIsDeleting(true);
      onDelete(branch.id);
      setIsDeleting(false);
    }
  };
  
  const canDelete = (branch.staff_count || 0) === 0 && (branch.total_stock || 0) === 0;

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5 hover:shadow-md transition-all duration-200 group">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500/10 to-indigo-50 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🏢</span>
            </div>
            <div>
              <h3 className="font-bold text-foreground">{branch.name}</h3>
              <p className="text-sm text-muted-foreground">
                Created: {new Date(branch.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-secondary/60 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600">{branch.staff_count || 0}</p>
              <p className="text-xs text-muted-foreground">Staff</p>
            </div>
            <div className="text-center p-3 bg-secondary/60 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{branch.product_count || 0}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
            <div className="text-center p-3 bg-secondary/60 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{branch.total_stock || 0}</p>
              <p className="text-xs text-muted-foreground">Total Stock</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col space-y-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => onEdit(branch)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Edit
          </Button>
          <Button 
            variant={canDelete ? "danger" : "ghost"}
            size="sm"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
            loading={isDeleting}
            className={!canDelete ? "opacity-50 cursor-not-allowed" : ""}
            title={!canDelete ? "Cannot delete: Branch has staff or stock" : ""}
          >
            {canDelete ? "Delete" : "Cannot Delete"}
          </Button>
        </div>
      </div>
      
      {!canDelete && (
        <div className="mt-3 p-2 bg-amber-500/100/10 border border-yellow-100 rounded-lg">
          <p className="text-xs text-yellow-700">
            ⚠️ Branch cannot be deleted. Remove all staff and transfer stock first.
          </p>
        </div>
      )}
    </div>
  );
};