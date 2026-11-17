import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Package, RotateCcw, MessageCircle } from 'lucide-react';
import { Button } from '../../../components/Button';
import { useCustomerNotifications } from '../../../hooks/shop/useCustomerNotifications';
import { shopRoutes } from '../../../lib/roleRedirect';

function typeIcon(type: string) {
  if (type === 'return') return RotateCcw;
  if (type === 'chat' || type === 'message') return MessageCircle;
  return Package;
}

export const AccountNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { signedIn, loading, notifications, unreadCount, markRead, markAllRead } =
    useCustomerNotifications();

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <Bell className="w-8 h-8 text-primary mx-auto" />
        <h1 className="text-lg font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to get alerts when your orders are updated.
        </p>
        <Link to={shopRoutes.customerLogin('/account/notifications')}>
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading && notifications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 px-3 sm:px-0 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Order updates, tracking, and returns
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={() => void markAllRead()}>
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="glass-card p-8 text-center space-y-2">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
          <p className="text-xs text-muted-foreground">
            You will be notified here when a store confirms, ships, or updates your order.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Icon = typeIcon(n.type);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={`w-full text-left glass-card p-3 transition-colors hover:bg-secondary/40 ${
                    n.read ? '' : 'border-primary/25 bg-primary/5'
                  }`}
                  onClick={() => {
                    if (!n.read) void markRead(n.id);
                    if (n.link) navigate(n.link);
                  }}
                >
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-secondary shrink-0 h-fit">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{n.title}</p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
