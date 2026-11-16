import { formatPlanLabel } from '@pos-inventory/shared';
import type { SubscriptionInfo } from './api';

export function buildRenewalMailto(subscription: SubscriptionInfo): string | null {
  const email = subscription.support_email?.trim();
  if (!email) return null;

  const subject = encodeURIComponent(`Subscription renewal — ${subscription.company_name}`);
  const renewalLine = subscription.plan_renewal_at
    ? `Renewal date: ${new Date(subscription.plan_renewal_at).toLocaleDateString()}`
    : 'Renewal date: not set';
  const body = encodeURIComponent(
    `Hello,\n\nI would like to renew the ${formatPlanLabel(subscription.plan)} subscription for ${subscription.company_name}.\n\n${renewalLine}\n\nThank you.`,
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export function buildSupportTel(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  return `tel:${trimmed.replace(/\s+/g, '')}`;
}
