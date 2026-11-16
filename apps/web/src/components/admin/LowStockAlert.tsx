import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';

interface LowStockAlertProps {
  alert: {
    id: string;
    product_id: string;
    product_name: string;
    branch_id?: string;
    branch_name?: string;
    current_stock: number;
    threshold: number;
    alert_type: 'low_stock' | 'out_of_stock' | 'sales_trend';
    created_at: string;
  };
  onDismiss: () => void;
}

export const LowStockAlert: React.FC<LowStockAlertProps> = ({ alert, onDismiss }) => {
  const [isDismissing, setIsDismissing] = useState(false);
  
  const dismissAlert = async () => {
    setIsDismissing(true);
    try {
      await supabase
        .from('stock_alerts')
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq('id', alert.id);
      onDismiss();
    } catch (error) {
      console.error('Error dismissing alert:', error);
    } finally {
      setIsDismissing(false);
    }
  };
  
  const getAlertConfig = (type: string) => {
    switch(type) {
      case 'low_stock':
        return { color: 'bg-amber-500/100/10 border-amber-500/20', icon: '⚠️', title: 'Low Stock' };
      case 'out_of_stock':
        return { color: 'bg-red-500/10 border-red-500/20', icon: '🚨', title: 'Out of Stock' };
      case 'sales_trend':
        return { color: 'bg-blue-500/10 border-blue-500/20', icon: '📈', title: 'High Sales Trend' };
      default:
        return { color: 'bg-secondary/60 border-border', icon: 'ℹ️', title: 'Alert' };
    }
  };
  
  const config = getAlertConfig(alert.alert_type);
  
  return (
    <div className={`${config.color} border rounded-xl p-4 mb-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-xl">{config.icon}</span>
          <div>
            <h4 className="font-bold text-foreground">{config.title}: {alert.product_name}</h4>
            <p className="text-sm text-muted-foreground">
              Current stock: <span className="font-bold">{alert.current_stock}</span> units 
              (Threshold: {alert.threshold} units)
            </p>
            {alert.branch_name && (
              <p className="text-sm text-muted-foreground">
                Branch: <span className="font-medium">{alert.branch_name}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(alert.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          loading={isDismissing}
          onClick={dismissAlert}
          className="text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};