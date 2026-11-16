import React, { useState, useEffect, useRef, useMemo } from 'react';
import type{ RealTimeNotification } from '../../types/index.ts';

interface RealtimeNotificationBellProps {
  notifications: RealTimeNotification[];
  onMarkAllAsSeen: () => void;
  onClearAll: () => void;
  onMarkAsSeen: (id: string) => void;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export const RealtimeNotificationBell: React.FC<RealtimeNotificationBellProps> = ({ 
  notifications, 
  onMarkAllAsSeen, 
  onClearAll, 
  onMarkAsSeen,
  connectionStatus 
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.seen).length, 
    [notifications]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationTypeColor = (type: RealTimeNotification['type']) => {
    switch (type) {
      case 'price': return 'bg-blue-500/15 text-blue-800';
      case 'stock': return 'bg-emerald-500/15 text-green-800';
      case 'low_stock': return 'bg-red-500/15 text-red-800';
      case 'product': return 'bg-purple-500/15 text-purple-800';
      case 'sale': return 'bg-amber-500/15 text-yellow-800';
      case 'return': return 'bg-orange-500/15 text-orange-800';
      case 'restock': return 'bg-indigo-500/15 text-indigo-800';
      default: return 'bg-secondary text-foreground';
    }
  };

  const formatNotificationType = (type: RealTimeNotification['type']) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };

  return (
    <div className="relative" ref={notificationsRef}>
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500/100 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      
      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-xl shadow-2xl border z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-foreground">Live Updates</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onMarkAllAsSeen();
                    setShowNotifications(false);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Mark all read
                </button>
                <button
                  onClick={() => {
                    onClearAll();
                    setShowNotifications(false);
                  }}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Clear All
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Real-time updates from admin</p>
          </div>
          
          <div className="overflow-y-auto max-h-72">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-3xl mb-3">📡</div>
                <p className="text-muted-foreground">No updates yet</p>
                <p className="text-xs text-muted-foreground mt-1">Changes will appear here</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={`notification-${notification.id}`}
                  className={`p-4 border-b hover:bg-secondary/60 transition-colors cursor-pointer ${!notification.seen ? 'bg-blue-500/10' : ''}`}
                  onClick={() => {
                    onMarkAsSeen(notification.id);
                    setShowNotifications(false);
                    
                    if (notification.productId) {
                      const element = document.querySelector(`[data-product-id="${notification.productId}"]`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('animate-pulse');
                        setTimeout(() => {
                          element.classList.remove('animate-pulse');
                        }, 2000);
                      }
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">{notification.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-foreground truncate">{notification.title}</h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(notification.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">{notification.description}</p>
                      <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center mt-2 ${getNotificationTypeColor(notification.type)}`}>
                        {formatNotificationType(notification.type)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-3 border-t bg-secondary/60">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Live connection:</span>
              <span className={`flex items-center ${connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full mr-1 ${connectionStatus === 'connected' ? 'bg-emerald-500/100 animate-pulse' : 'bg-red-500/100'}`}></span>
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};