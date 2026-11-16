import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, CheckCircle2, Loader2, Wallet } from 'lucide-react';
import { api, type PaystackBank, type PaystackPayoutSettings } from '../../lib/api';
import { Button } from '../Button';
import { toast } from 'sonner';

interface PaystackPayoutSettingsProps {
  companyId: string;
}

export const PaystackPayoutSettings: React.FC<PaystackPayoutSettingsProps> = ({ companyId }) => {
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [settings, setSettings] = useState<PaystackPayoutSettings | null>(null);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const verifyRequestId = useRef(0);

  /** Ghana bank accounts are usually 10 digits — verify once that length is reached */
  const canVerifyAccount = bankCode.length > 0 && accountNumber.length >= 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payoutRes, banksRes] = await Promise.all([
        api.getPaystackPayout(),
        api.getPaystackBanks(),
      ]);
      setSettings(payoutRes.data);
      setBanks(banksRes.data ?? []);
      setBankCode(payoutRes.data.payout_settlement_bank ?? '');
      setAccountNumber(payoutRes.data.payout_account_number ?? '');
      setAccountName(payoutRes.data.payout_account_name ?? '');
      setContactPhone(payoutRes.data.payout_contact_phone ?? '');
      setAccountVerified(Boolean(payoutRes.data.payout_account_name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payout settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (companyId) load();
  }, [companyId, load]);

  const verifyAccount = useCallback(
    async (code: string, number: string, options?: { silent?: boolean }) => {
      if (!code || number.length < 10) return false;

      const requestId = ++verifyRequestId.current;
      setVerifying(true);
      setAccountVerified(false);

      try {
        const res = await api.resolvePaystackAccount({
          bank_code: code,
          account_number: number,
        });

        if (requestId !== verifyRequestId.current) return false;

        setAccountName(res.data.account_name);
        setAccountVerified(true);
        if (!options?.silent) {
          toast.success('Account verified');
        }
        return true;
      } catch (e) {
        if (requestId !== verifyRequestId.current) return false;
        setAccountName('');
        setAccountVerified(false);
        if (!options?.silent) {
          toast.error(e instanceof Error ? e.message : 'Verification failed');
        }
        return false;
      } finally {
        if (requestId === verifyRequestId.current) {
          setVerifying(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!canVerifyAccount) {
      if (accountNumber.length > 0 && accountNumber.length < 10) {
        setAccountName('');
        setAccountVerified(false);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      void verifyAccount(bankCode, accountNumber, { silent: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [bankCode, accountNumber, canVerifyAccount, verifyAccount]);

  const handleBankChange = (code: string) => {
    setBankCode(code);
    setAccountName('');
    setAccountVerified(false);
  };

  const handleAccountNumberChange = (value: string) => {
    setAccountNumber(value.replace(/\D/g, ''));
    setAccountName('');
    setAccountVerified(false);
  };

  const handleSetup = async () => {
    if (!bankCode || accountNumber.length < 10) {
      toast.error('Select a bank and enter a valid account number');
      return;
    }
    if (!accountName) {
      toast.error('Waiting for account verification — check bank and account number');
      return;
    }
    setSaving(true);
    try {
      await api.setupPaystackPayout({
        settlement_bank: bankCode,
        account_number: accountNumber,
        account_name: accountName || undefined,
        contact_phone: contactPhone || undefined,
      });
      toast.success('Paystack payout connected — customers can pay you online');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setSaving(false);
    }
  };

  const status = settings?.paystack_subaccount_status ?? 'none';
  const isConnected = status === 'active' || status === 'pending';

  if (loading) {
    return (
      <div className="glass-card p-4 md:p-5 max-w-xl flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading payout settings…
      </div>
    );
  }

  if (!settings?.paystack_configured) {
    return (
      <div className="glass-card p-4 md:p-5 max-w-xl">
        <h2 className="text-sm font-semibold text-foreground">Online payments (Paystack)</h2>
        <p className="text-xs text-muted-foreground mt-2">
          Paystack keys are not configured on the API server. Add{' '}
          <code className="text-[10px]">PAYSTACK_SECRET_KEY</code> to{' '}
          <code className="text-[10px]">apps/api/.env</code> and restart the API.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 md:p-5 max-w-xl space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Marketplace payouts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect your bank account so Paystack splits customer payments to you automatically.
            Platform fee: {settings?.platform_fee_percent ?? settings?.default_platform_fee_percent}% per order.
          </p>
        </div>
      </div>

      {isConnected && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">
              {status === 'active' ? 'Payouts active' : 'Payout pending verification'}
            </p>
            {settings?.paystack_subaccount_code && (
              <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                {settings.paystack_subaccount_code}
              </p>
            )}
            {settings?.payout_account_name && (
              <p className="text-muted-foreground mt-1">
                {settings.payout_account_name} · ****
                {settings.payout_account_number?.slice(-4)}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="w-3.5 h-3.5" />
          Settlement bank account
        </div>

        <select
          className="input-modern py-2 text-sm w-full"
          value={bankCode}
          onChange={(e) => handleBankChange(e.target.value)}
        >
          <option value="">Select bank…</option>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>

        <input
          className="input-modern py-2 text-sm w-full"
          placeholder="Account number (10 digits)"
          value={accountNumber}
          onChange={(e) => handleAccountNumberChange(e.target.value)}
          inputMode="numeric"
          maxLength={13}
        />

        <div className="relative">
          <input
            className="input-modern py-2 text-sm w-full pr-9"
            placeholder={
              verifying
                ? 'Verifying account…'
                : 'Account name (filled automatically via Paystack)'
            }
            value={accountName}
            readOnly
            aria-busy={verifying}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {verifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : accountVerified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : null}
          </span>
        </div>

        <input
          className="input-modern py-2 text-sm w-full"
          placeholder="Contact phone (optional)"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />

        <Button
          fullWidth
          onClick={handleSetup}
          loading={saving}
          disabled={!bankCode || accountNumber.length < 10 || verifying || !accountName}
        >
          {isConnected ? 'Update payout account' : 'Connect Paystack payouts'}
        </Button>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          When customers pay via Paystack at checkout, funds are split: your store receives the order
          total minus the platform fee. Paystack settles to this bank account on their schedule.
        </p>
      </div>
    </div>
  );
};
