import React from 'react';
import { Link } from 'react-router-dom';
import {
  LogOut,
  Package,
  Star,
  MapPin,
  CreditCard,
  Settings,
  ChevronRight,
  Inbox,
  Pencil,
  Bell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCustomerSession } from '../../hooks/shop/useCustomerSession';
import { useCustomerNotifications } from '../../hooks/shop/useCustomerNotifications';
import { Button } from '../../components/Button';
import { useOnboardingTourStore } from '../../stores/onboardingTourStore';

const NAV_ITEMS = [
  {
    to: '/account/notifications',
    label: 'Notifications',
    description: 'Order updates & tracking',
    icon: Bell,
  },
  { to: '/account/inbox', label: 'Inbox', description: 'Messages with sellers', icon: Inbox },
  { to: '/account/orders', label: 'Orders', description: 'Track & return purchases', icon: Package },
  { to: '/account/addresses', label: 'Addresses', description: 'Delivery locations', icon: MapPin },
  { to: '/account/payment', label: 'Payment methods', description: 'MoMo & saved pay', icon: CreditCard },
  { to: '/account/reviews', label: 'My reviews', description: 'Products you rated', icon: Star },
  { to: '/account/settings', label: 'Settings', description: 'Push alerts & preferences', icon: Settings },
] as const;

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export const CustomerAccountPage: React.FC = () => {
  const { loading, signedIn, profile } = useCustomerSession();
  const { unreadCount } = useCustomerNotifications();
  const resetAudience = useOnboardingTourStore((s) => s.resetAudience);
  const startTour = useOnboardingTourStore((s) => s.startTour);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleReplayTour = () => {
    resetAudience('marketplace');
    startTour('marketplace', { force: true });
  };

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <h1 className="text-lg font-bold text-foreground">My account</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage your profile.</p>
        <Link to="/auth/login?redirect=/account">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>;
  }

  const displayName = profile?.fullName?.trim() || 'Customer';

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">My account</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-1" />
          Sign out
        </Button>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-lg font-bold text-primary shrink-0">
            {profileInitials(displayName)}
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-base font-semibold text-foreground truncate">{displayName}</p>
            {profile?.email && (
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            )}
            {profile?.phone && (
              <p className="text-xs text-muted-foreground">{profile.phone}</p>
            )}
            {profile?.address && (
              <p className="text-[11px] text-muted-foreground line-clamp-2 pt-0.5">{profile.address}</p>
            )}
          </div>
          <Link to="/account/profile" className="shrink-0">
            <Button size="sm" variant="secondary" className="gap-1">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <nav className="glass-card overflow-hidden divide-y divide-border">
        {NAV_ITEMS.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/80"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Icon className="w-4 h-4" />
              {to === '/account/notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-md bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {to === '/account/notifications' && unreadCount > 0
                  ? `${unreadCount} unread order update${unreadCount === 1 ? '' : 's'}`
                  : description}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/60" />
          </Link>
        ))}
      </nav>

      <Button variant="secondary" fullWidth size="sm" onClick={handleReplayTour}>
        Replay marketplace tour
      </Button>
    </div>
  );
};
