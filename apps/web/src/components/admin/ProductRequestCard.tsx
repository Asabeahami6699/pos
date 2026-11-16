import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';

interface ProductRequestCardProps {
  request: {
    id: string;
    product_id: string;
    product_name: string;
    branch_id: string;
    branch_name: string;
    requested_by: string;
    staff_name: string;
    quantity: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
    created_at: string;
  };
  onStatusChange: () => void;
}

export const ProductRequestCard: React.FC<ProductRequestCardProps> = ({ 
  request, 
  onStatusChange 
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const updateRequestStatus = async (status: string, message?: string) => {
    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('product_requests')
        .update({ 
          status,
          resolved_at: new Date().toISOString(),
          admin_notes: message 
        })
        .eq('id', request.id);
      
      if (error) throw error;
      
      // Create notification for staff member
      await supabase.from('notifications').insert({
        user_id: request.requested_by,
        title: `Product Request ${status}`,
        message: `Your request for ${request.product_name} has been ${status}`,
        type: status === 'approved' ? 'success' : 'warning'
      });
      
      onStatusChange();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const statusColors = {
    pending: 'bg-amber-500/15 text-yellow-800',
    approved: 'bg-blue-500/15 text-blue-800',
    rejected: 'bg-red-500/15 text-red-800',
    fulfilled: 'bg-emerald-500/15 text-green-800'
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5 hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[request.status]}`}>
              {request.status.toUpperCase()}
            </span>
            <span className="text-sm text-muted-foreground">
              {new Date(request.created_at).toLocaleString()}
            </span>
          </div>
          
          <h3 className="font-bold text-foreground text-lg">{request.product_name}</h3>
          <p className="text-muted-foreground">
            Requested by <span className="font-medium">{request.staff_name}</span> at{' '}
            <span className="font-medium">{request.branch_name}</span>
          </p>
        </div>
        
        <div className="text-right">
          <p className="text-3xl font-bold text-indigo-600">{request.quantity}</p>
          <p className="text-sm text-muted-foreground">units requested</p>
        </div>
      </div>
      
      {request.reason && (
        <div className="mb-4 p-3 bg-secondary/60 rounded-lg">
          <p className="text-sm text-foreground">
            <span className="font-medium">Reason:</span> {request.reason}
          </p>
        </div>
      )}
      
      {request.status === 'pending' && (
        <div className="flex space-x-2">
          <Button
            variant="primary"
            size="sm"
            loading={isUpdating}
            onClick={() => updateRequestStatus('approved')}
          >
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={isUpdating}
            onClick={() => {
              const message = prompt('Reason for rejection (optional):');
              updateRequestStatus('rejected', message || undefined);
            }}
          >
            Reject
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const message = prompt('Notes for fulfillment:');
              updateRequestStatus('fulfilled', message || undefined);
            }}
          >
            Mark Fulfilled
          </Button>
        </div>
      )}
    </div>
  );
};