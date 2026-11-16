import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Lock, Minus, Plus, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { shopApi, type CustomerAddress } from '../../lib/shopApi';
import {
  groupCartItemsByCompany,
  selectCartTotalAmount,
  useEcommerceCartStore,
  type ShopCartItem,
} from '../../stores/ecommerceCartStore';
import { Button } from '../../components/Button';
import { ProductImage } from '../../components/shop/ProductImage';
import { toast } from 'sonner';
import { generateIdempotencyKey, openPaystackCheckout } from '../../lib/paystackCheckout';
import { shopRoutes } from '../../lib/roleRedirect';

type PromoState = { code: string; discount: number };

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const items = useEcommerceCartStore((s) => s.items);
  const clearCompany = useEcommerceCartStore((s) => s.clearCompany);
  const updateQuantity = useEcommerceCartStore((s) => s.updateQuantity);
  const itemsByCompany = useMemo(() => groupCartItemsByCompany(items), [items]);
  const subtotal = useMemo(() => selectCartTotalAmount(items), [items]);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isCustomer, setIsCustomer] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payingStore, setPayingStore] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'pay_on_delivery'>('paystack');
  const [notes, setNotes] = useState('');
  const [promoByCompany, setPromoByCompany] = useState<Record<string, PromoState>>({});
  const [promoInput, setPromoInput] = useState<Record<string, string>>({});
  const [shippingFee, setShippingFee] = useState(0);
  const [estimatedDays, setEstimatedDays] = useState(3);
  const [saveInfo, setSaveInfo] = useState(true);

  const totalDiscount = useMemo(
    () => Object.values(promoByCompany).reduce((s, p) => s + p.discount, 0),
    [promoByCompany],
  );
  const grandTotal = Math.max(0, subtotal - totalDiscount + shippingFee);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setCheckingAuth(false);
        setIsCustomer(false);
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role, full_name, phone, address, email')
        .eq('id', session.user.id)
        .single();

      if (profile?.role === 'customer') {
        setIsCustomer(true);
        setCustomerEmail(profile.email ?? session.user.email ?? '');
        setShippingName(profile.full_name ?? '');
        setShippingPhone(profile.phone ?? '');
        setShippingAddress(profile.address ?? '');

        try {
          const addrRes = await shopApi.getAddresses();
          setAddresses(addrRes.data ?? []);
          const defaultAddr = addrRes.data?.find((a) => a.is_default) ?? addrRes.data?.[0];
          if (defaultAddr?.id) {
            setSelectedAddressId(defaultAddr.id);
            setShippingName(defaultAddr.full_name ?? profile.full_name ?? '');
            setShippingPhone(defaultAddr.phone ?? profile.phone ?? '');
            setShippingAddress(
              [defaultAddr.address_line, defaultAddr.city, defaultAddr.region]
                .filter(Boolean)
                .join(', '),
            );
          }
        } catch {
          /* optional */
        }
      }
      setCheckingAuth(false);
    });
  }, [items.length, navigate]);

  useEffect(() => {
    if (fulfillmentType === 'pickup') {
      setShippingFee(0);
      setEstimatedDays(1);
      return;
    }
    void shopApi
      .getShippingEstimate({
        region: shippingAddress,
        subtotal,
        fulfillment: fulfillmentType,
      })
      .then((res) => {
        setShippingFee(res.data.fee);
        setEstimatedDays(res.data.estimated_days);
      })
      .catch(() => setShippingFee(0));
  }, [fulfillmentType, shippingAddress, subtotal]);

  useEffect(() => {
    const ref = searchParams.get('reference');
    if (!ref || !isCustomer) return;
    shopApi
      .verifyPayment(ref)
      .then(() => {
        toast.success('Payment verified!');
        navigate('/orders');
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Verification failed'));
  }, [searchParams, isCustomer, navigate]);

  const applyAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    const addr = addresses.find((a) => a.id === addressId);
    if (!addr) return;
    setShippingName(addr.full_name ?? shippingName);
    setShippingPhone(addr.phone ?? shippingPhone);
    setShippingAddress([addr.address_line, addr.city, addr.region].filter(Boolean).join(', '));
  };

  const applyPromo = async (companyId: string) => {
    const code = promoInput[companyId]?.trim();
    if (!code) return;
    const lines = itemsByCompany[companyId];
    if (!lines?.length) return;
    const storeSubtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

    try {
      const res = await shopApi.validatePromo({
        code,
        company_id: companyId,
        subtotal: storeSubtotal,
      });
      setPromoByCompany((prev) => ({
        ...prev,
        [companyId]: { code: res.data.promo.code, discount: res.data.discount },
      }));
      toast.success(`Promo applied: -₵${res.data.discount.toFixed(2)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid promo code');
    }
  };

  const buildOrderPayload = (companyId: string, lines: ShopCartItem[]) => {
    const promo = promoByCompany[companyId];
    const storeCount = Object.keys(itemsByCompany).length;
    const storeShipping =
      fulfillmentType === 'pickup' ? 0 : Math.round((shippingFee / storeCount) * 100) / 100;

    return {
      company_id: companyId,
      shipping_name: shippingName,
      shipping_phone: shippingPhone,
      shipping_address: fulfillmentType === 'delivery' ? shippingAddress : undefined,
      fulfillment_type: fulfillmentType,
      address_id: selectedAddressId || undefined,
      notes: notes || undefined,
      promo_code: promo?.code,
      discount_amount: promo?.discount,
      shipping_fee: storeShipping,
      items: lines.map((l) => ({
        product_id: l.productId,
        product_name: l.name,
        quantity: l.quantity,
        unit_price: l.price,
      })),
    };
  };

  const payStoreWithPaystack = async (companyId: string, storeName: string) => {
    const lines = itemsByCompany[companyId];
    if (!lines?.length) return;

    const idempotencyKey = generateIdempotencyKey();
    const init = await shopApi.initializePayment({
      idempotency_key: idempotencyKey,
      ...buildOrderPayload(companyId, lines),
    });

    if (init.already_paid && init.data.order_id) {
      clearCompany(companyId);
      return;
    }

    const { reference, amount_kobo, public_key, email } = init.data;
    if (!reference || !amount_kobo || !public_key) {
      throw new Error('Invalid payment session');
    }

    setPayingStore(storeName);
    try {
      await openPaystackCheckout({
        key: public_key,
        email: email ?? customerEmail,
        amount: amount_kobo,
        ref: reference,
        currency: 'GHS',
        onClose: () => setPayingStore(null),
        callback: () => {},
      });

      await shopApi.verifyPayment(reference);
      clearCompany(companyId);
      toast.success(`Paid ${storeName} successfully`);
    } finally {
      setPayingStore(null);
    }
  };

  const handlePlaceOrder = async () => {
    if (!shippingName || !shippingPhone) {
      toast.error('Please fill in your contact details');
      return;
    }
    if (!isCustomer && !guestEmail.trim()) {
      toast.error('Please enter your email for order updates');
      return;
    }
    if (fulfillmentType === 'delivery' && !shippingAddress) {
      toast.error('Please provide a delivery address');
      return;
    }

    setSubmitting(true);
    const storeEntries = Object.entries(itemsByCompany);
    let lastGuestOrder: { id: string; token: string } | null = null;

    try {
      if (!isCustomer) {
        for (const [companyId, lines] of storeEntries) {
          const payload = buildOrderPayload(companyId, lines);
          const res = await shopApi.createGuestOrder({
            ...payload,
            guest_email: guestEmail.trim(),
            payment_method: 'pay_on_delivery',
          });
          localStorage.setItem(`guest-order-${res.data.id}`, res.data.guest_order_token);
          lastGuestOrder = { id: res.data.id, token: res.data.guest_order_token };
          clearCompany(companyId);
        }
        toast.success('Order placed!');
        if (lastGuestOrder) {
          navigate(`/orders/${lastGuestOrder.id}/track?token=${lastGuestOrder.token}`);
        } else {
          navigate('/');
        }
        return;
      }

      if (paymentMethod === 'pay_on_delivery') {
        for (const [companyId, lines] of storeEntries) {
          await shopApi.createOrder({
            ...buildOrderPayload(companyId, lines),
            payment_method: 'pay_on_delivery',
          });
          clearCompany(companyId);
        }
        toast.success('Order placed!');
        navigate('/orders');
        return;
      }

      for (const [companyId, lines] of storeEntries) {
        const storeName = lines[0]?.companyName ?? 'Store';
        await payStoreWithPaystack(companyId, storeName);
      }

      if (items.length === 0) {
        navigate('/orders');
      } else {
        toast.info('Some store payments may still be pending.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Checkout failed';
      if (msg.includes('Paystack is not configured')) {
        toast.error('Online payment unavailable', {
          description:
            'Use Pay on delivery, or add Paystack keys to apps/api/.env and restart the API.',
        });
      } else if (msg.includes('payout setup') || msg.includes('PAYOUT')) {
        toast.error('Store cannot accept online payment yet', { description: msg });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="text-center py-12 text-muted-foreground animate-pulse">Loading…</div>
    );
  }

  const storeCount = Object.keys(itemsByCompany).length;
  const effectivePaymentMethod = isCustomer ? paymentMethod : 'pay_on_delivery';
  const firstCompanyId = Object.keys(itemsByCompany)[0];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="jm-hero-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-foreground">Checkout</h1>
        <ol className="flex items-center gap-2 text-xs font-semibold">
          <li className="inline-flex items-center gap-1.5 text-emerald-600">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Check className="w-3 h-3" />
            </span>
            Cart
          </li>
          <span className="text-muted-foreground">—</span>
          <li className="inline-flex items-center gap-1.5 text-primary">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
              2
            </span>
            Checkout
          </li>
          <span className="text-muted-foreground">—</span>
          <li className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px]">
              3
            </span>
            Pay
          </li>
        </ol>
      </div>

      {!isCustomer && (
        <div className="jm-hero-panel p-3 text-xs text-muted-foreground space-y-2">
          <p>
            Checking out as <strong className="text-foreground">guest</strong>. Pay on delivery
            only — sign in for Paystack and saved addresses.
          </p>
          <div className="flex gap-2">
            <Link to="/auth/login?redirect=/checkout" className="text-primary hover:underline">
              Sign in
            </Link>
            <span>·</span>
            <Link to="/auth/signup?redirect=/checkout" className="text-primary hover:underline">
              Create account
            </Link>
          </div>
        </div>
      )}

      {storeCount > 1 && effectivePaymentMethod === 'paystack' && (
        <div className="jm-hero-panel p-3 text-xs text-muted-foreground">
          You will pay <strong className="text-foreground">{storeCount} stores separately</strong>{' '}
          via Paystack.
        </div>
      )}

      {payingStore && (
        <div className="jm-hero-panel p-3 text-sm text-primary animate-pulse">
          Complete Paystack payment for {payingStore}…
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        {/* Left: shipping + payment */}
        <div className="space-y-4">
          <section className="jm-hero-panel p-4 sm:p-5 space-y-4">
            <h2 className="text-base font-bold text-foreground">Shipping address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!isCustomer && (
                <input
                  className="input-modern py-2.5 text-sm sm:col-span-2"
                  type="email"
                  placeholder="Email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              )}
              <input
                className="input-modern py-2.5 text-sm sm:col-span-2"
                placeholder="Full name"
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
              />
              <input
                className="input-modern py-2.5 text-sm sm:col-span-2"
                placeholder="Phone"
                value={shippingPhone}
                onChange={(e) => setShippingPhone(e.target.value)}
              />
              {fulfillmentType === 'delivery' && (
                <>
                  {isCustomer && addresses.length > 0 && (
                    <select
                      className="input-modern py-2.5 text-sm sm:col-span-2"
                      value={selectedAddressId}
                      onChange={(e) => applyAddress(e.target.value)}
                    >
                      <option value="">Use saved address…</option>
                      {addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label} — {a.address_line}
                        </option>
                      ))}
                    </select>
                  )}
                  <textarea
                    className="input-modern py-2.5 text-sm min-h-[88px] sm:col-span-2"
                    placeholder="Street, city, region"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                  />
                </>
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={saveInfo}
                onChange={(e) => setSaveInfo(e.target.checked)}
                className="rounded border-border"
              />
              Save this information for next time
            </label>
          </section>

          <section className="jm-hero-panel p-4 sm:p-5 space-y-3">
            <h2 className="text-base font-bold text-foreground">Shipping method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillmentType('delivery')}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  fulfillmentType === 'delivery'
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Delivery</span>
                  {fulfillmentType === 'delivery' && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {shippingFee > 0
                    ? `₵${shippingFee.toFixed(2)} · ~${estimatedDays} business days`
                    : `Est. ${estimatedDays} business days`}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType('pickup')}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  fulfillmentType === 'pickup'
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Store pickup</span>
                  {fulfillmentType === 'pickup' && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Free · Ready in ~1 day</p>
              </button>
            </div>
          </section>

          <section className="jm-hero-panel p-4 sm:p-5 space-y-3">
            <h2 className="text-base font-bold text-foreground">Payment option</h2>
            {isCustomer ? (
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${
                    paymentMethod === 'paystack'
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === 'paystack'}
                    onChange={() => setPaymentMethod('paystack')}
                  />
                  <div>
                    <p className="text-sm font-semibold">Paystack</p>
                    <p className="text-xs text-muted-foreground">Card / MoMo / Bank</p>
                  </div>
                </label>
                <label
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${
                    paymentMethod === 'pay_on_delivery'
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === 'pay_on_delivery'}
                    onChange={() => setPaymentMethod('pay_on_delivery')}
                  />
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">Cash on delivery</p>
                      <p className="text-xs text-muted-foreground">Pay when you receive</p>
                    </div>
                  </div>
                </label>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Guest checkout uses <strong className="text-foreground">pay on delivery</strong>.
              </p>
            )}

            <input
              className="input-modern py-2.5 text-sm"
              placeholder="Order notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        {/* Right: order summary */}
        <aside className="jm-hero-panel p-4 sm:p-5 space-y-4 lg:sticky lg:top-24 bg-secondary/30">
          <h2 className="text-base font-bold text-foreground">Order summary</h2>

          <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin">
            {items.map((item) => {
              const priceType = item.priceType ?? 'retail';
              return (
                <div
                  key={`${item.companyId}-${item.productId}-${priceType}`}
                  className="flex gap-3"
                >
                  <div className="w-14 h-14 rounded-lg bg-card border border-border overflow-hidden shrink-0">
                    <ProductImage
                      imageUrl={item.imageUrl}
                      name={item.name}
                      className="w-full h-full object-cover"
                      iconClassName="text-base opacity-40"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold line-clamp-2">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                      ₵{item.price.toFixed(2)}
                    </p>
                    <div className="inline-flex items-center rounded-md border border-border mt-1 overflow-hidden">
                      <button
                        type="button"
                        className="w-6 h-6 flex items-center justify-center"
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.companyId,
                            item.quantity - 1,
                            priceType,
                          )
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-[11px] font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="w-6 h-6 flex items-center justify-center disabled:opacity-40"
                        disabled={item.quantity >= item.maxStock}
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.companyId,
                            item.quantity + 1,
                            priceType,
                          )
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {firstCompanyId && (
            <div className="space-y-2">
              {Object.entries(itemsByCompany).map(([companyId, lines]) => (
                <div key={companyId} className="flex gap-2">
                  <input
                    className="input-modern py-2 text-sm flex-1"
                    placeholder={`Promo · ${lines[0]?.companyName ?? 'store'}`}
                    value={promoInput[companyId] ?? ''}
                    onChange={(e) =>
                      setPromoInput((prev) => ({ ...prev, [companyId]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!rounded-lg"
                    onClick={() => void applyPromo(companyId)}
                  >
                    Apply
                  </Button>
                </div>
              ))}
              {totalDiscount > 0 && (
                <p className="text-xs text-emerald-600 font-medium">
                  Discount applied: -₵{totalDiscount.toFixed(2)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5 text-sm border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums font-medium">₵{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="tabular-nums font-medium">
                {shippingFee > 0 ? `₵${shippingFee.toFixed(2)}` : '₵0.00'}
              </span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span className="tabular-nums">-₵{totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary tabular-nums">₵{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <Button
            fullWidth
            size="lg"
            className="!rounded-xl"
            onClick={handlePlaceOrder}
            loading={submitting}
            disabled={!!payingStore}
          >
            {effectivePaymentMethod === 'paystack'
              ? `Pay ₵${grandTotal.toFixed(2)}`
              : 'Place order'}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            Secure checkout — SSL encrypted
          </p>
          <Link
            to={shopRoutes.cart}
            className="block text-center text-sm font-medium text-muted-foreground hover:text-primary"
          >
            Back to cart
          </Link>
        </aside>
      </div>
    </div>
  );
};
