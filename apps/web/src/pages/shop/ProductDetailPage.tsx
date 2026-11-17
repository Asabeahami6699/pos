import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  MessageCircle,
  Minus,
  Plus,
  Store,
  ShieldCheck,
  Truck,
  RotateCcw,
  MapPin,
  Star,
} from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import type { ShopCompany, ShopProduct } from '../../stores/ecommerceCatalogStore';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import { useEcommerceCartStore } from '../../stores/ecommerceCartStore';
import { ProductRatingStars } from '../../components/shop/ProductRatingStars';
import { ProductMediaGallery } from '../../components/shop/ProductMediaCarousel';
import { SeoHead } from '../../components/shop/SeoHead';
import { WishlistButton } from '../../components/shop/WishlistButton';
import { ShareProductButton } from '../../components/shop/ShareProductButton';
import { ShopProductCard } from '../../components/shop/ShopProductCard';
import {
  ProductDescriptionSection,
  ProductVariationPicker,
} from '../../components/shop/ProductDescriptionSection';
import {
  buildProductHighlights,
  buildProductSpecs,
  getProductAboutText,
  getProductKeyFeaturesText,
  getProductSpecificationsText,
  getProductVariations,
} from '../../lib/productDetailContent';
import { parseCategoryPath } from '../../lib/categoryGroups';
import { shopRoutes } from '../../lib/roleRedirect';
import { customerAuthPaths, isSignedInCustomer } from '../../lib/requireCustomerAuth';
import {
  getDefaultPriceType,
  getPriceForType,
  productHasDualPricing,
  productHasRetailPrice,
  productHasWholesalePrice,
  type ShopPriceType,
} from '../../lib/shopProductPricing';
import { Button } from '../../components/Button';
import { toast } from 'sonner';

type DetailTab = 'description' | 'specifications' | 'reviews';

export const ProductDetailPage: React.FC = () => {
  const { companyId, productId } = useParams<{ companyId: string; productId: string }>();
  const navigate = useNavigate();

  const addItem = useEcommerceCartStore((s) => s.addItem);
  const items = useEcommerceCartStore((s) => s.items);
  const updateQuantity = useEcommerceCartStore((s) => s.updateQuantity);

  const setProductDetail = useEcommerceCatalogStore((s) => s.setProductDetail);
  const cachedCompany = useEcommerceCatalogStore((s) =>
    companyId ? s.storeCompany[companyId] : null,
  );
  const cachedProduct = useEcommerceCatalogStore((s) => {
    if (!companyId || !productId) return undefined;
    const key = `${companyId}:${productId}`;
    if (s.productDetails[key]) return s.productDetails[key];
    return (
      s.marketplaceProducts.find((p) => p.id === productId && p.company_id === companyId) ??
      s.storeProducts[companyId]?.find((p) => p.id === productId)
    );
  });

  const [company, setCompany] = useState<ShopCompany | null>(cachedCompany);
  const [product, setProduct] = useState<ShopProduct | null>(cachedProduct ?? null);
  const [loadingDetail, setLoadingDetail] = useState(!cachedProduct);
  const [priceType, setPriceType] = useState<ShopPriceType>('retail');
  const [related, setRelated] = useState<ShopProduct[]>([]);
  const [sellerProducts, setSellerProducts] = useState<ShopProduct[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<DetailTab>('description');
  const sessionId = useEcommerceCatalogStore((s) => s.sessionId);

  const loadProduct = useCallback(
    async (silent = false) => {
      if (!companyId || !productId) return;
      if (!silent && !product) setLoadingDetail(true);
      try {
        const res = await shopApi.getProductDetail(companyId, productId);
        setCompany(res.data.company);
        setProduct(res.data.product);
        setProductDetail(companyId, productId, res.data.product);
        setPriceType(getDefaultPriceType(res.data.product));
        const variations = getProductVariations(res.data.product);
        setSelectedVariation(variations[0] ?? null);
      } catch (e) {
        if (!product) {
          toast.error(e instanceof Error ? e.message : 'Failed to load product');
          navigate('/');
        }
      } finally {
        setLoadingDetail(false);
      }
    },
    [companyId, productId, navigate, product, setProductDetail],
  );

  useEffect(() => {
    if (cachedCompany && !company) setCompany(cachedCompany);
    if (cachedProduct && !product) {
      setProduct(cachedProduct);
      setPriceType(getDefaultPriceType(cachedProduct));
      setSelectedVariation(getProductVariations(cachedProduct)[0] ?? null);
    }
  }, [cachedCompany, cachedProduct, company, product]);

  useEffect(() => {
    loadProduct(Boolean(cachedProduct));
  }, [companyId, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyId || !productId) return;
    void shopApi.trackProductView({
      product_id: productId,
      company_id: companyId,
      session_id: sessionId,
    });
    void shopApi.getRelatedProducts(companyId, productId).then((res) => {
      setRelated(res.data ?? []);
    });
    void shopApi.getStoreProducts(companyId).then((res) => {
      const others = (res.data?.products ?? [])
        .filter((p) => p.id !== productId && p.in_stock)
        .slice(0, 8);
      setSellerProducts(others);
    });
  }, [companyId, productId, sessionId]);

  const dualPricing = product ? productHasDualPricing(product) : false;
  const selectedPrice = product ? getPriceForType(product, priceType) : 0;

  const cartLine = useMemo(
    () =>
      items.find(
        (i) =>
          i.productId === productId &&
          i.companyId === companyId &&
          (i.priceType ?? 'retail') === priceType,
      ),
    [items, productId, companyId, priceType],
  );
  const inCart = cartLine?.quantity ?? 0;

  if (!companyId || !productId) return null;

  const handleAdd = async (buyNow = false) => {
    if (!product?.in_stock || !company) return;
    const addQty = Math.max(1, qty);
    for (let i = 0; i < addQty; i += 1) {
      addItem({
        companyId,
        companyName: company.name,
        productId: product.id,
        name: product.name,
        sku: product.sku ?? '',
        price: getPriceForType(product, priceType),
        priceType,
        maxStock: product.stock,
        imageUrl: product.image_url ?? undefined,
        category: product.category,
      });
    }
    if (buyNow) {
      const ok = await isSignedInCustomer();
      if (!ok) {
        const { login } = customerAuthPaths(shopRoutes.checkout);
        toast.error('Sign in required', {
          description: 'Sign in or create an account before you can buy.',
          action: { label: 'Sign in', onClick: () => navigate(login) },
        });
        navigate(login);
        return;
      }
      navigate(shopRoutes.checkout);
      return;
    }
    toast.success('Added to cart');
  };

  if (loadingDetail && !product) {
    return (
      <div className="text-center py-16 text-muted-foreground animate-pulse">
        Loading product…
      </div>
    );
  }

  if (!product || !company) return null;

  const { main, sub } = parseCategoryPath(product.category);
  const highlights = buildProductHighlights(product);
  const specs = buildProductSpecs(product, company);
  const about = getProductAboutText(product);
  const specsText = getProductSpecificationsText(product);
  const featuresText = getProductKeyFeaturesText(product);
  const retail = Number(product.price) || 0;
  const wholesale = Number(product.wholesale_price) || 0;
  const showSaveBadge =
    dualPricing &&
    productHasRetailPrice(product) &&
    productHasWholesalePrice(product) &&
    wholesale > 0 &&
    retail > wholesale;
  const savePct =
    showSaveBadge && retail > 0
      ? Math.round(((retail - wholesale) / retail) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <SeoHead title={product.name} description={about.slice(0, 160)} />

      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
        <Link to={shopRoutes.home} className="hover:text-primary">
          Home
        </Link>
        {main && (
          <>
            <span>›</span>
            <Link
              to={shopRoutes.category(main)}
              className="hover:text-primary capitalize"
            >
              {main}
            </Link>
          </>
        )}
        {sub && (
          <>
            <span>›</span>
            <span className="capitalize">{sub}</span>
          </>
        )}
        <span>›</span>
        <span className="text-foreground line-clamp-1">{product.name}</span>
      </nav>

      {/* Product spotlight */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_260px] gap-4 items-start">
        <div className="jm-hero-panel overflow-hidden p-2 sm:p-3">
          <ProductMediaGallery
            name={product.name}
            imageUrl={product.image_url}
            media={product.media}
            autoPlay
            compact={false}
          />
        </div>

        <div className="jm-hero-panel p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground leading-tight">
                {product.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {(product.rating_count ?? 0) > 0 ? (
                  <ProductRatingStars
                    rating={product.average_rating ?? 0}
                    count={product.rating_count ?? 0}
                    size="md"
                  />
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="w-3.5 h-3.5" /> No reviews yet
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  · {product.in_stock ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <WishlistButton productId={product.id} companyId={companyId} />
              <ShareProductButton
                title={product.name}
                url={`/product/${companyId}/${product.id}`}
              />
            </div>
          </div>

          <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
            {dualPricing ? (
              <div className="grid grid-cols-2 gap-2">
                {productHasRetailPrice(product) && (
                  <button
                    type="button"
                    onClick={() => setPriceType('retail')}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      priceType === 'retail'
                        ? 'border-primary bg-card'
                        : 'border-transparent hover:border-border'
                    }`}
                  >
                    <span className="text-[10px] uppercase text-muted-foreground">Retail</span>
                    <p className="text-lg font-extrabold text-primary tabular-nums">
                      ₵{retail.toFixed(2)}
                    </p>
                  </button>
                )}
                {productHasWholesalePrice(product) && (
                  <button
                    type="button"
                    onClick={() => setPriceType('wholesale')}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      priceType === 'wholesale'
                        ? 'border-primary bg-card'
                        : 'border-transparent hover:border-border'
                    }`}
                  >
                    <span className="text-[10px] uppercase text-muted-foreground">Wholesale</span>
                    <p className="text-lg font-extrabold text-primary tabular-nums">
                      ₵{wholesale.toFixed(2)}
                    </p>
                  </button>
                )}
              </div>
            ) : (
              <p className="text-3xl font-extrabold text-primary tabular-nums">
                ₵{selectedPrice.toFixed(2)}
              </p>
            )}
            {showSaveBadge && priceType === 'wholesale' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="line-through text-muted-foreground">₵{retail.toFixed(2)}</span>
                <span className="rounded-md bg-primary/15 text-primary font-bold px-1.5 py-0.5">
                  Save {savePct}%
                </span>
              </div>
            )}
          </div>

          {highlights.length > 0 && (
            <ul className="space-y-1.5">
              {highlights.slice(0, 5).map((h) => (
                <li key={h} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          {getProductVariations(product).length > 0 && (
            <ProductVariationPicker
              variations={getProductVariations(product)}
              selected={selectedVariation}
              onSelect={setSelectedVariation}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center hover:bg-secondary"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center hover:bg-secondary disabled:opacity-40"
                disabled={qty >= product.stock}
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {inCart > 0 && (
              <span className="text-xs text-muted-foreground">{inCart} already in cart</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              fullWidth
              size="lg"
              className="!rounded-xl"
              onClick={() => handleAdd(false)}
              disabled={!product.in_stock}
            >
              Add to cart
            </Button>
            <Button
              fullWidth
              size="lg"
              variant="secondary"
              className="!rounded-xl !border-primary !text-primary"
              onClick={() => handleAdd(true)}
              disabled={!product.in_stock}
            >
              Buy now
            </Button>
          </div>

          {inCart > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => updateQuantity(product.id, companyId, inCart - 1, priceType)}
                className="p-2 rounded-lg bg-secondary"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-semibold tabular-nums">{inCart} in cart</span>
              <button
                type="button"
                onClick={() => updateQuantity(product.id, companyId, inCart + 1, priceType)}
                disabled={inCart >= product.stock}
                className="p-2 rounded-lg bg-secondary disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Seller / delivery card */}
        <aside className="jm-hero-panel p-4 space-y-3 lg:sticky lg:top-24">
          <div className="flex items-start gap-3">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt=""
                className="w-11 h-11 rounded-lg object-cover border border-border"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{company.name}</p>
              {company.location && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {company.location}
                </p>
              )}
            </div>
          </div>
          <Link
            to={`/store/${companyId}`}
            className="block text-center text-xs font-bold rounded-xl border border-primary text-primary py-2 hover:bg-primary/5"
          >
            Visit store
          </Link>
          <Button
            fullWidth
            variant="secondary"
            className="!rounded-xl"
            onClick={() =>
              navigate(shopRoutes.chatRoom(companyId), { state: { companyName: company.name } })
            }
          >
            <MessageCircle className="w-4 h-4 mr-2 inline" />
            Chat with seller
          </Button>

          <div className="border-t border-border pt-3 space-y-2.5 text-xs">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary" />
              Delivery
            </p>
            <p className="text-muted-foreground">
              Ships from seller inventory
              {company.location ? ` · ${company.location}` : ''}. Fees calculated at checkout.
            </p>
            <p className="font-bold text-foreground flex items-center gap-1.5 pt-1">
              <RotateCcw className="w-3.5 h-3.5 text-primary" />
              Returns
            </p>
            <p className="text-muted-foreground">
              Contact the seller for return eligibility on this item.
            </p>
            <p className="font-bold text-foreground flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Buyer protection
            </p>
            <p className="text-muted-foreground">
              Secure checkout with order tracking in your account.
            </p>
          </div>
        </aside>
      </section>

      {/* Tabs + related sidebar */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="jm-hero-panel overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto scrollbar-thin">
            {(
              [
                { id: 'description' as const, label: 'Description' },
                { id: 'specifications' as const, label: 'Specifications' },
                { id: 'reviews' as const, label: 'Customer reviews' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap ${
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {tab === 'description' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {about}
                </p>
                {featuresText && (
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-2">Key features</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {featuresText}
                    </p>
                  </div>
                )}
                {highlights.length > 0 && (
                  <ul className="space-y-1.5">
                    {highlights.map((h) => (
                      <li key={h} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary font-bold">✓</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Rich listing panels (size guide, product details, etc.) */}
                <ProductDescriptionSection product={product} company={company} />
              </div>
            )}

            {tab === 'specifications' && (
              <div className="space-y-3">
                {specsText && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{specsText}</p>
                )}
                <div className="rounded-xl border border-border overflow-hidden">
                  {specs.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[140px_minmax(0,1fr)] text-sm border-b border-border last:border-b-0"
                    >
                      <div className="px-3 py-2 bg-secondary/50 font-medium text-foreground">
                        {row.label}
                      </div>
                      <div className="px-3 py-2 text-muted-foreground">{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'reviews' && (
              <div className="space-y-3">
                {(product.rating_count ?? 0) > 0 ? (
                  <>
                    <ProductRatingStars
                      rating={product.average_rating ?? 0}
                      count={product.rating_count ?? 0}
                      size="md"
                    />
                    <p className="text-sm text-muted-foreground">
                      Based on {product.rating_count} customer rating
                      {product.rating_count === 1 ? '' : 's'}. Detailed reviews appear after
                      purchase.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No customer reviews yet. Be the first to rate this product after your order.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="jm-hero-panel p-3 space-y-3 lg:sticky lg:top-24">
          <h2 className="text-sm font-bold px-1">You may also like</h2>
          <div className="space-y-2">
            {(related.length > 0 ? related : sellerProducts).slice(0, 4).map((p) => (
              <ShopProductCard
                key={p.id}
                product={p}
                companyId={companyId}
                companyName={company.name}
                size="compact"
                showAddToCart
              />
            ))}
            {related.length === 0 && sellerProducts.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-4 text-center">
                More products coming soon
              </p>
            )}
          </div>
        </aside>
      </section>

      {sellerProducts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">More from {company.name}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sellerProducts.map((p) => (
              <ShopProductCard
                key={p.id}
                product={p}
                companyId={companyId}
                companyName={company.name}
                size="compact"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
