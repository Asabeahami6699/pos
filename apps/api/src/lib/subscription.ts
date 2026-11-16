export type SubscriptionAccess = 'active' | 'warning' | 'locked';

export interface SubscriptionStatus {
  plan: string;
  status: string;
  plan_started_at: string | null;
  plan_renewal_at: string | null;
  days_until_renewal: number | null;
  access: SubscriptionAccess;
  lock_reason: string | null;
}

export function evaluateSubscription(row: {
  plan: string;
  status: string;
  plan_started_at: string | null;
  plan_renewal_at: string | null;
}): SubscriptionStatus {
  const now = Date.now();
  const renewalMs = row.plan_renewal_at ? new Date(row.plan_renewal_at).getTime() : null;
  const daysUntilRenewal =
    renewalMs != null ? Math.ceil((renewalMs - now) / (1000 * 60 * 60 * 24)) : null;

  if (row.status === 'suspended') {
    return {
      plan: row.plan,
      status: row.status,
      plan_started_at: row.plan_started_at,
      plan_renewal_at: row.plan_renewal_at,
      days_until_renewal: daysUntilRenewal,
      access: 'locked',
      lock_reason: 'Your account has been suspended. Contact platform support to restore access.',
    };
  }

  if (row.status === 'expired' || (renewalMs != null && renewalMs < now)) {
    return {
      plan: row.plan,
      status: row.status === 'expired' ? 'expired' : 'expired',
      plan_started_at: row.plan_started_at,
      plan_renewal_at: row.plan_renewal_at,
      days_until_renewal: daysUntilRenewal,
      access: 'locked',
      lock_reason: 'Your subscription has expired. Please renew to continue using the dashboard.',
    };
  }

  if (daysUntilRenewal != null && daysUntilRenewal <= 7 && daysUntilRenewal > 0) {
    return {
      plan: row.plan,
      status: row.status,
      plan_started_at: row.plan_started_at,
      plan_renewal_at: row.plan_renewal_at,
      days_until_renewal: daysUntilRenewal,
      access: 'warning',
      lock_reason: null,
    };
  }

  return {
    plan: row.plan,
    status: row.status,
    plan_started_at: row.plan_started_at,
    plan_renewal_at: row.plan_renewal_at,
    days_until_renewal: daysUntilRenewal,
    access: 'active',
    lock_reason: null,
  };
}
