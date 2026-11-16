import React from 'react';
import { Modal } from '../Modal';
import type{ Branch } from '../../types/index.ts';

interface SalesTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesType: 'retail' | 'wholesale';
  setSalesType: (type: 'retail' | 'wholesale') => void;
  availableSalesTypes: ('retail' | 'wholesale')[];
  selectedBranch: Branch | null;
}

export const SalesTypeModal: React.FC<SalesTypeModalProps> = ({
  isOpen,
  onClose,
  salesType,
  setSalesType,
  availableSalesTypes,
  selectedBranch
}) => {
  const handleSalesTypeChange = (type: 'retail' | 'wholesale') => {
    setSalesType(type);
    onClose();
  };

  const getBranchTypeDescription = () => {
    if (!selectedBranch) return '';
    
    switch (selectedBranch.sales_type) {
      case 'retail':
        return 'This branch only supports retail sales.';
      case 'wholesale':
        return 'This branch only supports wholesale sales.';
      case 'both':
        return 'This branch supports both retail and wholesale sales.';
      default:
        return '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Sales Type"
    >
      <div className="space-y-4 py-4">
        <div className="text-sm text-muted-foreground text-center mb-4">
          Choose the sales type for this session
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSalesTypeChange('retail')}
            className={`
              p-4 rounded-xl border-2 flex flex-col items-center justify-center
              transition-all duration-200
              ${salesType === 'retail' 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-border hover:border-indigo-300 hover:bg-secondary/60'
              }
              ${!availableSalesTypes.includes('retail') ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            disabled={!availableSalesTypes.includes('retail')}
          >
            <div className="text-2xl mb-2">🛍️</div>
            <div className="font-bold text-foreground">Retail</div>
            <div className="text-sm text-muted-foreground mt-1">Standard pricing</div>
            {!availableSalesTypes.includes('retail') && (
              <div className="text-xs text-red-500 mt-2">Not available</div>
            )}
          </button>
          
          <button
            onClick={() => handleSalesTypeChange('wholesale')}
            className={`
              p-4 rounded-xl border-2 flex flex-col items-center justify-center
              transition-all duration-200
              ${salesType === 'wholesale' 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-border hover:border-blue-300 hover:bg-secondary/60'
              }
              ${!availableSalesTypes.includes('wholesale') ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            disabled={!availableSalesTypes.includes('wholesale')}
          >
            <div className="text-2xl mb-2">📦</div>
            <div className="font-bold text-foreground">Wholesale</div>
            <div className="text-sm text-muted-foreground mt-1">Bulk pricing</div>
            {!availableSalesTypes.includes('wholesale') && (
              <div className="text-xs text-red-500 mt-2">Not available</div>
            )}
          </button>
        </div>
        
        <div className="pt-4 border-t">
          <div className="text-xs text-muted-foreground text-center">
            <p className="font-medium mb-1">Current Branch Information</p>
            <p>
              <span className="font-semibold">Branch:</span> {selectedBranch?.name || 'N/A'}
            </p>
            <p>
              <span className="font-semibold">Branch Type:</span> {
                selectedBranch?.sales_type === 'retail' ? 'Retail Only' :
                selectedBranch?.sales_type === 'wholesale' ? 'Wholesale Only' :
                selectedBranch?.sales_type === 'both' ? 'Retail & Wholesale' :
                selectedBranch?.sales_type || 'N/A'
              }
            </p>
            <p className="mt-2 italic">{getBranchTypeDescription()}</p>
          </div>
        </div>
        
        <div className="pt-2">
          <div className="text-xs text-muted-foreground">
            <p className="mb-1">
              <span className="font-semibold">Current Selection:</span> {
                salesType === 'retail' ? '🛍️ Retail Mode' : '📦 Wholesale Mode'
              }
            </p>
            <p>
              <span className="font-semibold">Available Options:</span> {
                availableSalesTypes.map(type => 
                  type === 'retail' ? 'Retail' : 'Wholesale'
                ).join(', ')
              }
            </p>
          </div>
        </div>
        
        <div className="flex justify-center pt-2">
          <button
            onClick={onClose}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};