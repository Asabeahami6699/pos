import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Smartphone } from 'lucide-react';
import { AccountSectionLayout } from '../../../components/shop/AccountSectionLayout';
import { useCustomerSession } from '../../../hooks/shop/useCustomerSession';
import {
  formatPaymentMethodSummary,
  useCustomerAccountStore,
} from '../../../stores/customerAccountStore';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { toast } from 'sonner';

type AddMode = 'mobile_money' | 'card';

const CARD_BRANDS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'verve', label: 'Verve' },
] as const;

export const AccountPaymentPage: React.FC = () => {
  const { loading, signedIn } = useCustomerSession();
  const paymentMethods = useCustomerAccountStore((s) => s.paymentMethods);
  const paymentMethodsLoading = useCustomerAccountStore((s) => s.paymentMethodsLoading);
  const fetchPaymentMethods = useCustomerAccountStore((s) => s.fetchPaymentMethods);
  const addMomoPayment = useCustomerAccountStore((s) => s.addMomoPayment);
  const addCardPayment = useCustomerAccountStore((s) => s.addCardPayment);
  const resetAccount = useCustomerAccountStore((s) => s.resetAccount);

  const [addMode, setAddMode] = useState<AddMode>('mobile_money');
  const [saving, setSaving] = useState(false);
  const [momoForm, setMomoForm] = useState({ provider: 'mtn', phone_number: '', label: 'MoMo' });
  const [cardForm, setCardForm] = useState({
    provider: 'visa',
    label: '',
    card_last4: '',
    card_exp_month: '',
    card_exp_year: '',
  });

  useEffect(() => {
    if (signedIn) {
      void fetchPaymentMethods();
    } else {
      resetAccount();
    }
  }, [signedIn, fetchPaymentMethods, resetAccount]);

  if (!signedIn && !loading) {
    return (
      <div className="max-w-md mx-auto glass-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to manage payment methods.</p>
        <Link to="/auth/login?redirect=/account/payment">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (loading || (paymentMethodsLoading && paymentMethods.length === 0)) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse text-sm">Loading…</div>;
  }

  const saveMomo = async () => {
    if (!momoForm.phone_number.trim() || momoForm.phone_number.trim().length < 9) {
      toast.error('Enter a valid phone number');
      return;
    }
    setSaving(true);
    try {
      await addMomoPayment({
        provider: momoForm.provider,
        phone_number: momoForm.phone_number.trim(),
        label: momoForm.label.trim() || 'MoMo',
      });
      toast.success('Mobile money saved');
      setMomoForm({ provider: 'mtn', phone_number: '', label: 'MoMo' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveCard = async () => {
    const last4 = cardForm.card_last4.replace(/\D/g, '').slice(-4);
    const month = Number(cardForm.card_exp_month);
    let year = Number(cardForm.card_exp_year);
    if (year < 100) year += 2000;

    if (last4.length !== 4) {
      toast.error('Enter the last 4 digits of your card');
      return;
    }
    if (!month || month < 1 || month > 12) {
      toast.error('Enter a valid expiry month (01–12)');
      return;
    }
    if (!year || year < new Date().getFullYear()) {
      toast.error('Enter a valid expiry year');
      return;
    }

    setSaving(true);
    try {
      await addCardPayment({
        provider: cardForm.provider,
        label: cardForm.label.trim() || undefined,
        card_last4: last4,
        card_exp_month: month,
        card_exp_year: year,
      });
      toast.success('Card saved');
      setCardForm({
        provider: 'visa',
        label: '',
        card_last4: '',
        card_exp_month: '',
        card_exp_year: '',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountSectionLayout title="Payment methods">
      <p className="text-xs text-muted-foreground -mt-2">
        Save MoMo numbers or debit/credit cards for faster checkout. We only store card last 4 digits and expiry.
      </p>

      <div className="space-y-3">
        {paymentMethods.length === 0 ? (
          <div className="glass-card p-4 text-sm text-muted-foreground text-center">
            No saved payment methods yet.
          </div>
        ) : (
          paymentMethods.map((method) => (
            <div key={method.id} className="glass-card p-3 flex items-start gap-3 text-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                {method.type === 'card' ? (
                  <CreditCard className="w-4 h-4" />
                ) : (
                  <Smartphone className="w-4 h-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold capitalize">
                  {method.type === 'card' ? 'Card' : method.type.replace(/_/g, ' ')}
                  {method.is_default ? (
                    <span className="ml-2 text-[10px] font-medium text-primary">Default</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {method.label && method.type !== 'card'
                    ? `${method.label} · ${formatPaymentMethodSummary(method)}`
                    : formatPaymentMethodSummary(method)}
                </p>
              </div>
            </div>
          ))
        )}

        <div className="glass-card p-4 space-y-3">
          <div className="flex gap-1 p-1 rounded-lg bg-secondary/80">
            <button
              type="button"
              onClick={() => setAddMode('mobile_money')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
                addMode === 'mobile_money'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile money
            </button>
            <button
              type="button"
              onClick={() => setAddMode('card')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
                addMode === 'card'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Card
            </button>
          </div>

          {addMode === 'mobile_money' ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Add MoMo number</p>
              <select
                className="input-modern py-2 text-sm w-full"
                value={momoForm.provider}
                onChange={(e) => setMomoForm({ ...momoForm, provider: e.target.value })}
              >
                <option value="mtn">MTN</option>
                <option value="vodafone">Telecel</option>
                <option value="airteltigo">AT Money</option>
              </select>
              <Input
                label="Label (optional)"
                value={momoForm.label}
                onChange={(e) => setMomoForm({ ...momoForm, label: e.target.value })}
              />
              <Input
                label="Phone number"
                value={momoForm.phone_number}
                onChange={(e) => setMomoForm({ ...momoForm, phone_number: e.target.value })}
                placeholder="e.g. 0241234567"
              />
              <Button onClick={saveMomo} loading={saving} fullWidth>
                Save mobile money
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Add debit / credit card</p>
              <p className="text-[11px] text-muted-foreground">
                Enter card details you use with Paystack at checkout. Full card numbers are not stored.
              </p>
              <select
                className="input-modern py-2 text-sm w-full"
                value={cardForm.provider}
                onChange={(e) => setCardForm({ ...cardForm, provider: e.target.value })}
              >
                {CARD_BRANDS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                label="Nickname (optional)"
                value={cardForm.label}
                onChange={(e) => setCardForm({ ...cardForm, label: e.target.value })}
                placeholder="e.g. Personal Visa"
              />
              <Input
                label="Last 4 digits"
                value={cardForm.card_last4}
                onChange={(e) =>
                  setCardForm({
                    ...cardForm,
                    card_last4: e.target.value.replace(/\D/g, '').slice(0, 4),
                  })
                }
                inputMode="numeric"
                placeholder="4242"
                maxLength={4}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Exp. month"
                  value={cardForm.card_exp_month}
                  onChange={(e) =>
                    setCardForm({
                      ...cardForm,
                      card_exp_month: e.target.value.replace(/\D/g, '').slice(0, 2),
                    })
                  }
                  inputMode="numeric"
                  placeholder="MM"
                  maxLength={2}
                />
                <Input
                  label="Exp. year"
                  value={cardForm.card_exp_year}
                  onChange={(e) =>
                    setCardForm({
                      ...cardForm,
                      card_exp_year: e.target.value.replace(/\D/g, '').slice(0, 4),
                    })
                  }
                  inputMode="numeric"
                  placeholder="YYYY"
                  maxLength={4}
                />
              </div>
              <Button onClick={saveCard} loading={saving} fullWidth>
                Save card
              </Button>
            </div>
          )}
        </div>
      </div>
    </AccountSectionLayout>
  );
};
