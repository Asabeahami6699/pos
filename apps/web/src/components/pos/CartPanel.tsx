import React from 'react';
import { PosProductThumb } from './PosProductThumb';
import { Input } from '../Input';
import { CreditCard, ShoppingCart, Trash2, User, X } from 'lucide-react';
import type { CartItem, Customer } from '../../types/index';

interface CartPanelProps {
  cart: CartItem[];
  salesType: 'retail' | 'wholesale';
  customer: Customer;
  discountPercentage: number;
  discountAmount: number;
  setDiscountPercentage: (value: number) => void;
  setDiscountAmount: (value: number) => void;
  setShowCustomerModal: (show: boolean) => void;
  setShowPaymentModal: (show: boolean) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  applyDiscount: (productId: string, discount: number) => void;
  clearCart: () => void;
  calculateSubtotal: () => number;
  calculateTotalDiscount: () => number;
  calculateTax: () => number;
  calculateTotal: () => number;
  calculateItemTotal?: (item: CartItem) => number;
  submitting: boolean;
  taxRatePercent?: number;
  discountsEnabled?: boolean;
  quickDiscounts?: number[];
  /** Mobile sheet close control */
  onClose?: () => void;
  className?: string;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  salesType,
  customer,
  discountPercentage,
  discountAmount,
  setDiscountPercentage,
  setDiscountAmount,
  setShowCustomerModal,
  setShowPaymentModal,
  removeFromCart,
  updateQuantity,
  applyDiscount,
  clearCart,
  calculateSubtotal,
  calculateTotalDiscount,
  calculateTax,
  calculateTotal,
  calculateItemTotal,
  submitting,
  taxRatePercent = 16,
  discountsEnabled = true,
  quickDiscounts = [5, 10, 15],
  onClose,
  className = '',
}) => {
  const isWholesale = salesType === 'wholesale';
  const totalDiscount = calculateTotalDiscount();
  const discountChips = quickDiscounts.filter((d) => d > 0);

  const safeCalculateItemTotal =
    calculateItemTotal ||
    ((item: CartItem) => {
      const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
      return priceAfterDiscount * item.quantity;
    });

  return (
    <div
      data-tour="pos-cart"
      className={`w-full lg:w-[380px] xl:w-[400px] bg-card shadow-xl flex flex-col h-full lg:border-l border-border ${className}`}
    >
      <div className="p-4 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-secondary text-foreground flex items-center justify-center shrink-0 lg:hidden"
              aria-label="Close cart"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-bold text-base text-foreground">Current Sale</h2>
            <p className="text-[11px] text-muted-foreground capitalize truncate">
              {salesType} · {cart.length} item{cart.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearCart}
          disabled={cart.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden xs:inline sm:inline">Clear</span>
        </button>
      </div>

      <div className="px-4 pt-3 shrink-0">
        <button
          type="button"
          onClick={() => setShowCustomerModal(true)}
          className="w-full flex items-center gap-2 text-sm text-primary hover:bg-primary/5 font-medium bg-primary/5 border border-primary/15 px-3 py-2.5 rounded-xl transition-colors"
        >
          <User className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 text-left">
            {customer.name ? customer.name : 'Add Customer'}
          </span>
          {customer.phone ? (
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
              {customer.phone}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-secondary mx-auto mb-3 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-foreground font-semibold text-sm">Cart is empty</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Tap products to add them to this sale
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={`cart-${item.product.id}`}
              className={`bg-secondary/50 rounded-2xl p-3 border border-border/60 ${
                isWholesale ? 'border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex gap-3">
                <PosProductThumb
                  imageUrl={item.product.image_url}
                  name={item.product.name}
                  size="sm"
                  className="rounded-xl"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-sm font-bold text-orange-500 mt-0.5">
                        ₵{item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-muted-foreground hover:text-red-500 p-1 shrink-0 rounded-lg hover:bg-red-500/10"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2.5">
                    <div className="inline-flex items-center rounded-full bg-card border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-secondary text-foreground font-semibold"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= (item.product.stock || 0)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-secondary disabled:opacity-40 text-foreground font-semibold"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-foreground">
                        ₵{safeCalculateItemTotal(item).toFixed(2)}
                      </div>
                      {item.discount > 0 && (
                        <div className="text-[10px] text-emerald-600">-{item.discount}% off</div>
                      )}
                    </div>
                  </div>

                  {discountsEnabled && item.discount === 0 && discountChips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {discountChips.map((discount) => (
                        <button
                          key={`discount-${item.product.id}-${discount}`}
                          type="button"
                          onClick={() => applyDiscount(item.product.id, discount)}
                          className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                        >
                          {discount}% off
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border space-y-3 shrink-0 bg-card">
        <div className="rounded-2xl bg-secondary/60 border border-border/70 p-3.5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground">₵{calculateSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-medium text-emerald-600">
              -₵{totalDiscount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRatePercent}%)</span>
            <span className="font-medium text-foreground">₵{calculateTax().toFixed(2)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between items-baseline">
            <span className="font-bold text-foreground">Total</span>
            <span className="text-xl font-extrabold text-primary">
              ₵{calculateTotal().toFixed(2)}
            </span>
          </div>
        </div>

        {totalDiscount > 0 && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-700 text-center">
            You saved ₵{totalDiscount.toFixed(2)} on this order!
          </div>
        )}

        {discountsEnabled ? (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Discount %"
              value={discountPercentage || ''}
              onChange={(e) => setDiscountPercentage(Number(e.target.value))}
              className="text-sm"
            />
            <Input
              type="number"
              placeholder="Discount ₵"
              value={discountAmount || ''}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
              className="text-sm"
            />
          </div>
        ) : (
          <p className="text-[11px] text-center text-muted-foreground">
            Cart discounts are disabled by admin
          </p>
        )}

        <button
          type="button"
          data-tour="pos-checkout"
          onClick={() => setShowPaymentModal(true)}
          disabled={cart.length === 0 || submitting}
          className="w-full h-14 text-base font-bold shadow-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-colors"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <CreditCard className="w-5 h-5" />
            {submitting ? 'Processing…' : 'Proceed to Checkout'}
            {!submitting && <span aria-hidden>→</span>}
          </span>
        </button>
      </div>
    </div>
  );
};
