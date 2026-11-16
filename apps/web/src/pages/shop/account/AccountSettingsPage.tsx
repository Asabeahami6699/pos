import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { AccountSectionLayout } from '../../../components/shop/AccountSectionLayout';
import { useCustomerSession } from '../../../hooks/shop/useCustomerSession';
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../../lib/pushNotifications';
import { Button } from '../../../components/Button';
import { toast } from 'sonner';

export const AccountSettingsPage: React.FC = () => {
  const { loading, signedIn } = useCustomerSession();
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshPush = useCallback(async () => {
    const status = await getPushStatus();
    setPushConfigured(status.configured);
    setPushSubscribed(status.subscribed);
  }, []);

  useEffect(() => {
    if (signedIn) void refreshPush();
  }, [signedIn, refreshPush]);

  const enablePush = async () => {
    setPushBusy(true);
    try {
      const result = await subscribeToPush();
      if (result === 'granted') {
        toast.success('Push notifications enabled');
        await refreshPush();
      } else if (result === 'denied') {
        toast.error('Notification permission denied');
      } else if (result === 'unconfigured') {
        toast.error('Push not configured on server', {
          description: 'Add VAPID keys to apps/api/.env and restart the API.',
        });
      } else {
        toast.error('Push not supported in this browser');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not enable push');
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      toast.success('Push notifications disabled');
      await refreshPush();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disable push');
    } finally {
      setPushBusy(false);
    }
  };

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to view settings.</p>
        <Link to="/auth/login?redirect=/account/settings">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>;
  }

  return (
    <AccountSectionLayout title="Settings">
      <div className="glass-card p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Push notifications
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Optional browser alerts for new seller messages (opens Inbox), order updates, and returns.
          </p>
        </div>

        {!pushConfigured && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-3">
            Server push is not configured yet. Ask your admin to set VAPID keys on the API.
          </p>
        )}

        {pushSubscribed ? (
          <Button variant="secondary" onClick={disablePush} disabled={pushBusy} className="gap-2">
            {pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
            Turn off push
          </Button>
        ) : (
          <Button onClick={enablePush} disabled={pushBusy || !pushConfigured} className="gap-2">
            {pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Enable push notifications
          </Button>
        )}
      </div>
    </AccountSectionLayout>
  );
};
