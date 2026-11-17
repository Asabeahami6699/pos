import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Package, RotateCcw, MessageCircle } from 'lucide-react';
import { useCustomerNotifications } from '../../hooks/shop/useCustomerNotifications';
import { shopRoutes } from '../../lib/roleRedirect';

function typeIcon(type: string) {
  if (type === 'return') return RotateCcw;
  if (type === 'chat' || type === 'message') return MessageCircle;
  return Package;
}

export const MarketplaceNotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { signedIn, notifications, unreadCount, markRead, markAllRead } = useCustomerNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!signedIn) {
    return (
      <Link
        to={shopRoutes.customerLogin('/account/notifications')}
        className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] text-muted-foreground hover:bg-secondary"
        title="Sign in for order alerts"
      >
        <Bell className="w-5 h-5" />
        Alerts
      </Link>
    );
  }

  const recent = notifications.slice(0, 8);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] text-muted-foreground hover:bg-secondary"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        Alerts
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 rounded-md bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No notifications yet. Order updates will show up here.
              </p>
            ) : (
              recent.map((n) => {
                const Icon = typeIcon(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`w-full text-left px-3 py-2.5 border-b border-border/70 hover:bg-secondary/60 transition-colors ${
                      n.read ? '' : 'bg-primary/5'
                    }`}
                    onClick={() => {
                      if (!n.read) void markRead(n.id);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                      else navigate('/account/notifications');
                    }}
                  >
                    <div className="flex gap-2.5">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-secondary shrink-0">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Link
            to="/account/notifications"
            className="block text-center text-xs font-medium text-primary py-2.5 hover:bg-secondary/50"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};
