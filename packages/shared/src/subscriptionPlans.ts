export const SUBSCRIPTION_PLANS = ['trial', 'six_month', 'yearly'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/** Canonical plan slug stored on new companies (legacy basic/premium are normalized). */
export function normalizeSubscriptionPlan(plan: string): SubscriptionPlan {
  switch (plan) {
    case 'six_month':
    case 'basic':
      return 'six_month';
    case 'yearly':
    case 'premium':
    case 'year':
      return 'yearly';
    case 'trial':
    default:
      return 'trial';
  }
}

export function computePlanRenewalDate(plan: string, from = new Date()): Date {
  const d = new Date(from);
  switch (normalizeSubscriptionPlan(plan)) {
    case 'six_month':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'trial':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

export const PLAN_OPTIONS: Array<{ value: SubscriptionPlan; label: string }> = [
  { value: 'trial', label: 'Trial (1 month)' },
  { value: 'six_month', label: '6 months' },
  { value: 'yearly', label: 'Yearly' },
];

export function formatPlanLabel(plan: string): string {
  switch (normalizeSubscriptionPlan(plan)) {
    case 'six_month':
      return '6 months';
    case 'yearly':
      return 'Yearly';
    case 'trial':
    default:
      return 'Trial';
  }
}

export function subscriptionPlanBucket(plan: string): SubscriptionPlan {
  return normalizeSubscriptionPlan(plan);
}
