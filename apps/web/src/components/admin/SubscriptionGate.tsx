import React from 'react';
import { AlertTriangle, CalendarClock, Lock, Mail, Phone } from 'lucide-react';
import { formatPlanLabel } from '@pos-inventory/shared';
import type { SubscriptionInfo } from '../../lib/api';
import { buildRenewalMailto, buildSupportTel } from '../../lib/supportContact';
import { Button } from '../Button';

interface SubscriptionBannerProps {
  subscription: SubscriptionInfo;
}

function SupportContactActions({
  subscription,
  variant = 'default',
}: {
  subscription: SubscriptionInfo;
  variant?: 'default' | 'lock';
}) {
  const mailto = buildRenewalMailto(subscription);
  const tel = buildSupportTel(subscription.support_phone);
  const hasContact = Boolean(mailto || tel);

  if (!hasContact) {
    return (
      <p className="text-xs text-muted-foreground">
        Support contact is not configured yet. Ask your platform administrator to add a support email
        in Platform → Settings.
      </p>
    );
  }

  const linkClass =
    variant === 'lock'
      ? 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity w-full'
      : 'inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline shrink-0';

  return (
    <div className={`flex flex-col gap-2 ${variant === 'default' ? 'sm:flex-row sm:items-center' : ''}`}>
      {mailto && (
        <a href={mailto} className={linkClass}>
          <Mail className="w-4 h-4" />
          Email support to renew
        </a>
      )}
      {tel && (
        <a
          href={tel}
          className={
            variant === 'lock'
              ? 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border border-border hover:bg-secondary/60 transition-colors w-full'
              : 'inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:underline shrink-0'
          }
        >
          <Phone className="w-4 h-4" />
          {subscription.support_phone}
        </a>
      )}
    </div>
  );
}

export const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({ subscription }) => {
  if (subscription.access !== 'warning') return null;

  const days = subscription.days_until_renewal ?? 0;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1">
        <CalendarClock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Subscription renewal due soon</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your {formatPlanLabel(subscription.plan)} plan renews in {days} day{days === 1 ? '' : 's'} (
            {subscription.plan_renewal_at
              ? new Date(subscription.plan_renewal_at).toLocaleDateString()
              : 'soon'}
            ). Contact platform support to renew and avoid interruption.
          </p>
        </div>
      </div>
      <SupportContactActions subscription={subscription} />
    </div>
  );
};

interface SubscriptionLockScreenProps {
  subscription: SubscriptionInfo;
  onLogout: () => void;
}

export const SubscriptionLockScreen: React.FC<SubscriptionLockScreenProps> = ({
  subscription,
  onLogout,
}) => {
  const isSuspended = subscription.status === 'suspended';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/60 to-secondary p-4">
      <div className="glass-card max-w-md w-full p-6 md:p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          {isSuspended ? (
            <Lock className="w-7 h-7 text-red-600" />
          ) : (
            <AlertTriangle className="w-7 h-7 text-red-600" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isSuspended ? 'Account suspended' : 'Subscription expired'}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {subscription.lock_reason ??
              'Please renew your subscription to continue using the dashboard.'}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-3 text-left text-xs space-y-1">
          <p>
            <span className="text-muted-foreground">Company:</span>{' '}
            <span className="font-medium text-foreground">{subscription.company_name}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Plan:</span>{' '}
            <span className="font-medium">{formatPlanLabel(subscription.plan)}</span>
          </p>
          {subscription.plan_renewal_at && (
            <p>
              <span className="text-muted-foreground">Renewal date:</span>{' '}
              <span className="font-medium">
                {new Date(subscription.plan_renewal_at).toLocaleDateString()}
              </span>
            </p>
          )}
        </div>
        <SupportContactActions subscription={subscription} variant="lock" />
        <Button variant="secondary" onClick={onLogout} fullWidth>
          Log out
        </Button>
      </div>
    </div>
  );
};
