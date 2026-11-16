import React from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { Button } from '../../Button';

interface NotificationsTabProps {
  notifications: any[];
  loading: boolean;
  handleMarkNotificationAsRead: (notificationId: string) => void;
  handleMarkAllNotificationsAsRead: () => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  notifications,
  loading,
  handleMarkNotificationAsRead,
  handleMarkAllNotificationsAsRead
}) => {
  return (
    <div className="flex flex-col h-full">  {/* Full height container */}
      <DashboardHeader 
        title="Notifications" 
        subtitle="System alerts and updates"
        actionButton={{
          label: 'Mark All as Read',
          onClick: handleMarkAllNotificationsAsRead
        }}
      />
      
      <div className="flex-1 overflow-y-auto max-h-[70vh] px-4 pb-4">  {/* Scrollable container with max height */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`bg-card rounded-xl shadow-sm border p-5 ${notification.read ? 'border-border' : 'border-indigo-500/20 bg-indigo-500/10'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className={`text-lg mr-3 ${
                        notification.type === 'info' ? 'text-blue-600' :
                        notification.type === 'warning' ? 'text-yellow-600' :
                        notification.type === 'error' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {notification.type === 'info' ? 'ℹ️' :
                         notification.type === 'warning' ? '⚠️' :
                         notification.type === 'error' ? '❌' : '✅'}
                      </span>
                      <h3 className={`font-bold ${notification.read ? 'text-foreground' : 'text-indigo-900'}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="ml-2 px-2 py-1 bg-indigo-500/15 text-indigo-800 text-xs rounded-full">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mb-3">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleMarkNotificationAsRead(notification.id)}
                    >
                      Mark as Read
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {notifications.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔔</div>
                <h3 className="text-lg font-medium text-foreground mb-2">No notifications</h3>
                <p className="text-muted-foreground">You're all caught up!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};