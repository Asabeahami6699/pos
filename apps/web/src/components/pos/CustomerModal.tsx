import React from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import type{ Customer } from '../../types/index.ts';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  setCustomer: (customer: Customer) => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  setCustomer
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Details"
    >
      <div className="space-y-4">
        <Input
          label="Customer Name"
          value={customer.name}
          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
          placeholder="Walk-in customer"
        />
        <Input
          label="Phone Number"
          value={customer.phone || ''}
          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
          placeholder="+254 700 000 000"
        />
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};