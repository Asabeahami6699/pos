import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onPayment: (payment: any) => void;
  submitting: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  total,
  onPayment,
  submitting
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | 'split'>('cash');
  const [amount, setAmount] = useState<string>(total.toFixed(2));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // EFFECT: Auto-detect amount when modal opens or total changes
  // This ensures the input is always pre-filled with the exact total,
  // saving time, but remains editable.
  useEffect(() => {
    if (isOpen) {
      setAmount(total.toFixed(2));
      setReference(''); // Optional: Reset reference on new payment
      setNotes('');      // Optional: Reset notes on new payment
    }
  }, [isOpen, total]);

  // Helper: Format number to 2 decimal places for clean input
  const formatAmount = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num.toFixed(2);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatAmount(e.target.value));
  };

  const handleSubmit = () => {
    onPayment({
      method: paymentMethod,
      amount: parseFloat(amount),
      reference,
      notes
    });
  };

  const calculateChange = () => {
    const paid = parseFloat(amount) || 0;
    return Math.max(0, paid - total);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Payment">
      <div className="space-y-6">
        {/* Total Display */}
        <div className="bg-secondary/60 p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold text-indigo-600">${total.toFixed(2)}</p>
        </div>

        {/* Payment Method */}
        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={(value) => setPaymentMethod(value as any)}
          options={[
            { value: 'cash', label: '💵 Cash' },
            { value: 'mobile_money', label: '📱 Mobile Money' },
            { value: 'card', label: '💳 Card' },
            { value: 'split', label: '💰 Split Payment' }
          ]}
          required
        />

        {/* Amount Received */}
        <div>
           <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-foreground">Amount Received</label>
            {parseFloat(amount) === total && (
               <span className="text-xs text-indigo-600 font-medium">Auto-filled</span>
            )}
          </div>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={handleAmountChange}
            required
            className="font-bold text-lg"
          />
        </div>

        {paymentMethod === 'mobile_money' && (
          <Input
            label="Transaction Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="M-Pesa/Equitel reference"
          />
        )}

        {/* Change Display */}
        {paymentMethod === 'cash' && parseFloat(amount) > total && (
          <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 animate-fade-in">
            <p className="text-sm text-green-800 font-medium">
              Change: <span className="font-bold">${calculateChange().toFixed(2)}</span>
            </p>
          </div>
        )}

        {/* Payment Notes */}
        <Input
          label="Payment Notes (Optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Customer receipt number"
        />

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitting || parseFloat(amount) <= 0}>
            Complete Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};