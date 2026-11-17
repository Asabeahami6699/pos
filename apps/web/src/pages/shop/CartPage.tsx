import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, Sparkles, Minus, Plus, ArrowRight, Heart } from 'lucide-react';
import {
  groupCartItemsByCompany,
  selectCartTotalAmount,
  useEcommerceCartStore,
} from '../../stores/ecommerceCartStore';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import { groupCartRecommendations } from '../../lib/cartRecommendations';
import { Button } from '../../components/Button';
import { ProductImage } from '../../components/shop/ProductImage';
import { ShopProductCard } from '../../components/shop/ShopProductCard';
import { WishlistButton } from '../../components/shop/WishlistButton';
import { shopRoutes } from '../../lib/roleRedirect';
import { customerAuthPaths, isSignedInCustomer } from '../../lib/requireCustomerAuth';
import { toast } from 'sonner';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const items = useEcommerceCartStore((s) => s.items);
  const updateQuantity = useEcommerceCartStore((s) => s.updateQuantity);
  const removeItem = useEcommerceCartStore((s) => s.removeItem);
  const clearAll = useEcommerceCartStore((s) => s.clearAll);
  const marketplaceProducts = useEcommerceCatalogStore((s) => s.marketplaceProducts);
  const totalAmount = useMemo(() => selectCartTotalAmount(items), [items]);
  const groups = useMemo(() => groupCartItemsByCompany(items), [items]);
  const recommendationSections = useMemo(
    () => groupCartRecommendations(items, marketplaceProducts),
    [items, marketplaceProducts],
  );
  const [checkingOut, setCheckingOut] = useState(false);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const shipping = 0;
  const tax = 0;
  const total = totalAmount + shipping + tax;

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const ok = await isSignedInCustomer();
      if (!ok) {
        const { login } = customerAuthPaths(shopRoutes.checkout);
        toast.error('Sign in required', {
          description: 'Create an account or sign in before you can buy.',
          action: {
            label: 'Sign in',
            onClick: () => navigate(login),
          },
        });
        navigate(login);
        return;
      }
      navigate(shopRoutes.checkout);
    } finally {
      setCheckingOut(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Your cart is empty</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Browse products and add items.</p>
        <Link to={shopRoutes.home}>
          <Button className="!rounded-xl">Continue shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <nav className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Link to={shopRoutes.home} className="hover:text-primary">
          Home
        </Link>
        <span>→</span>
        <span className="text-foreground">Shopping Cart</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        {/* Cart items */}
        <section className="jm-hero-panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Your Shopping Cart</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {itemCount} item{itemCount === 1 ? '' : 's'} from {Object.keys(groups).length} store
                {Object.keys(groups).length === 1 ? '' : 's'}
              </p>
            </div>
            <Link
              to={shopRoutes.home}
              className="text-sm font-semibold text-primary hover:underline underline-offset-2"
            >
              Continue shopping
            </Link>
          </div>

          <div className="space-y-4 max-h-[28rem] overflow-y-auto scrollbar-thin pr-1">
            {Object.entries(groups).map(([companyId, lines]) => (
              <div key={companyId} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {lines[0]?.companyName}
                </h2>
                {lines.map((item) => {
                  const lineKey = `${item.companyId}-${item.productId}-${item.priceType ?? 'retail'}`;
                  const priceType = item.priceType ?? 'retail';
                  const lineTotal = item.price * item.quantity;
                  return (
                    <div
                      key={lineKey}
                      className="flex gap-3 sm:gap-4 py-3 border-t border-border first:border-t-0"
                    >
                      <Link
                        to={`/product/${item.companyId}/${item.productId}`}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-secondary shrink-0 overflow-hidden flex items-center justify-center"
                      >
                        <ProductImage
                          imageUrl={item.imageUrl}
                          name={item.name}
                          className="w-full h-full object-cover"
                          iconClassName="text-xl opacity-40"
                        />
                      </Link>

                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to={`/product/${item.companyId}/${item.productId}`}
                              className="text-sm font-semibold text-foreground hover:text-primary line-clamp-2"
                            >
                              {item.name}
                            </Link>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.sku ? `SKU ${item.sku}` : item.companyName}
                              {priceType === 'wholesale' && (
                                <span className="ml-1 uppercase text-[10px] font-semibold text-primary">
                                  · Wholesale
                                </span>
                              )}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-foreground tabular-nums shrink-0">
                            ₵{item.price.toFixed(2)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                          <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                            <button
                              type="button"
                              className="w-8 h-8 flex items-center justify-center hover:bg-secondary"
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.companyId,
                                  item.quantity - 1,
                                  priceType,
                                )
                              }
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-9 text-center text-sm font-semibold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              className="w-8 h-8 flex items-center justify-center hover:bg-secondary disabled:opacity-40"
                              disabled={item.quantity >= item.maxStock}
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.companyId,
                                  item.quantity + 1,
                                  priceType,
                                )
                              }
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                            onClick={() => removeItem(item.productId, item.companyId, priceType)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>

                          <WishlistButton
                            productId={item.productId}
                            companyId={item.companyId}
                            className="!p-1.5 !rounded-lg"
                          />

                          <p className="ml-auto text-sm font-bold text-primary tabular-nums">
                            ₵{lineTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              className="!rounded-xl"
              onClick={() => {
                clearAll();
                toast.success('Cart cleared');
              }}
            >
              Clear
            </Button>
            <Button
              className="!rounded-xl"
              onClick={() => toast.success('Cart saved on this device')}
            >
              Save cart
            </Button>
          </div>
        </section>

        {/* Order summary */}
        <aside className="jm-hero-panel p-4 sm:p-5 space-y-4 lg:sticky lg:top-24">
          <h2 className="text-base font-bold text-foreground">Order summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold tabular-nums">₵{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-semibold text-emerald-600">
                {shipping === 0 ? 'Calculated at checkout' : `₵${shipping.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-semibold tabular-nums">₵{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border text-base">
              <span className="font-bold">Total</span>
              <span className="font-extrabold text-primary tabular-nums">₵{total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            fullWidth
            size="lg"
            className="!rounded-xl gap-2"
            loading={checkingOut}
            onClick={() => void handleCheckout()}
          >
            Checkout
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Link
            to={shopRoutes.home}
            className="block text-center text-sm font-medium text-muted-foreground hover:text-primary"
          >
            Continue shopping
          </Link>
          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Heart className="w-3 h-3" />
            Save items to wishlist while you shop
          </p>
        </aside>
      </div>

      {recommendationSections.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">You might also like</h2>
          </div>
          {recommendationSections.map((section) => (
            <div key={section.categoryLabel} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground capitalize">
                {section.categoryLabel}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {section.products.map((product) => {
                  const companyId = product.company_id!;
                  return (
                    <ShopProductCard
                      key={`${companyId}-${product.id}`}
                      product={product}
                      companyId={companyId}
                      companyName={product.company_name ?? 'Store'}
                      size="compact"
                      showAddToCart
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
