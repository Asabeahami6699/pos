import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CustomerOrdersPanel } from '../../components/shop/CustomerOrdersPanel';
import { Button } from '../../components/Button';

export const CustomerOrdersPage: React.FC = () => {
  const [signedIn, setSignedIn] = React.useState(false);
  const [checkedAuth, setCheckedAuth] = React.useState(false);
  const [guestOrderId, setGuestOrderId] = React.useState('');
  const [guestToken, setGuestToken] = React.useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setSignedIn(false);
        setCheckedAuth(true);
        return;
      }
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      setSignedIn(profile?.role === 'customer');
      setCheckedAuth(true);
    });
  }, []);

  if (!signedIn && checkedAuth) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <div className="glass-card p-8 text-center space-y-3">
          <LogIn className="w-10 h-10 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Your orders</h1>
          <p className="text-sm text-muted-foreground">Sign in to view order history.</p>
          <Link to="/auth/login?redirect=/orders">
            <Button>Sign in</Button>
          </Link>
        </div>

        <div className="glass-card p-6 space-y-3">
          <h2 className="text-sm font-semibold">Track a guest order</h2>
          <input
            className="input-modern py-2 text-sm w-full"
            placeholder="Order ID"
            value={guestOrderId}
            onChange={(e) => setGuestOrderId(e.target.value)}
          />
          <input
            className="input-modern py-2 text-sm w-full"
            placeholder="Tracking token (from checkout email)"
            value={guestToken}
            onChange={(e) => setGuestToken(e.target.value)}
          />
          <Link
            to={
              guestOrderId.trim()
                ? `/orders/${guestOrderId.trim()}/track${guestToken.trim() ? `?token=${encodeURIComponent(guestToken.trim())}` : ''}`
                : '#'
            }
            className={!guestOrderId.trim() ? 'pointer-events-none opacity-50' : ''}
          >
            <Button fullWidth disabled={!guestOrderId.trim()}>
              Track order
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground">My orders</h1>
      <CustomerOrdersPanel />
    </div>
  );
};
