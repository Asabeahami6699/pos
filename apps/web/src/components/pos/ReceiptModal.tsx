// ReceiptModal.tsx
import React from 'react';
import { Button } from '../Button';
import { Receipt } from './Receipt';
import type { CartItem, Customer, Branch, User } from '../../types/index.ts';

interface ReceiptModalProps {
  cart: CartItem[];
  total: number;
  customer: Customer;
  salesType: 'retail' | 'wholesale';
  branch: Branch | null;
  salesperson: User | null;
  onClose: () => void;
  onNewSale: () => void;
  onPrint?: () => void;
  onSave?: () => void;
  taxRatePercent?: number;
  discountTotal?: number;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  cart,
  total,
  customer,
  salesType,
  branch,
  salesperson,
  onClose,
  onNewSale,
  onPrint,
  onSave,
  taxRatePercent = 16,
  discountTotal = 0,
}) => {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      // Default print behavior
      window.print();
    }
  };

  const handleDownload = () => {
    if (onSave) {
      onSave();
    } else {
      // Default save behavior
      alert('Download receipt functionality would trigger here');
    }
  };

  // Calculate subtotal and tax for the receipt
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const itemTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
      return sum + itemTotal;
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const taxable = Math.max(0, subtotal - discountTotal);
  const tax = taxable * (taxRatePercent / 100);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-foreground">Transaction Receipt</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrint}
            >
              Print
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownload}
            >
              Download PDF
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onClose}
              className="bg-red-500/15 text-red-700 hover:bg-red-200"
            >
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-secondary/60">
          {branch && salesperson && (
            <Receipt
              sale={cart}
              total={total}
              customer={customer}
              salesType={salesType}
              branch={branch}
              salesperson={salesperson}
              subtotal={subtotal}
              tax={tax}
              onPrint={onPrint}
              onSave={onSave}
            />
          )}
        </div>

        <div className="p-4 border-t bg-card shrink-0 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Keep Open
          </Button>
          <Button
            onClick={() => {
              onNewSale();
              onClose();
            }}
          >
            New Sale
          </Button>
        </div>
      </div>
    </div>
  );
};