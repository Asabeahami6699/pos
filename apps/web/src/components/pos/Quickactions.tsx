import React, { useState } from 'react';
import { Button } from '../Button';
import { toast } from 'sonner';

interface QuickActionsProps {
  onLogout: () => Promise<void> | void;
  onViewReports: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onLogout,
  onViewReports
}) => {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      
      // Check if onLogout returns a promise
      const result = onLogout();
      if (result && typeof result.then === 'function') {
        await result;
      } else {
        // If it's not a promise, just call it
        onLogout();
      }
      
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={onViewReports}
      >
        📊 Reports
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        loading={loggingOut}
        disabled={loggingOut}
      >
        {loggingOut ? 'Logging out...' : 'Logout'}
      </Button>
    </div>
  );
};