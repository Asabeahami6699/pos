import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Package,
  Tags,
  ChevronRight,
  Zap,
  Smartphone,
  Shirt,
  Home,
  ShoppingBag,
  Baby,
  Utensils,
  Laptop,
  Grid3X3,
  User,
} from 'lucide-react';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import { applyProductFilters, useMarketplaceUiStore } from '../../stores/marketplaceUiStore';
import { productMatchesCategoryFilter } from '../../lib/categoryGroups';
import { StoreCard } from '../../components/shop/StoreCard';
import { ShopProductCard } from '../../components/shop/ShopProductCard';
import { PromotedProductsStrip } from '../../components/shop/PromotedProductsStrip';
import { MarketplaceToolbar } from '../../components/shop/MarketplaceToolbar';
import { useMarketplaceBootstrap } from '../../hooks/shop/useMarketplaceBootstrap';
import { isWholesaleProduct } from '../../lib/shopProductPricing';
import { shopApi } from '../../lib/shopApi';
import { shopRoutes } from '../../lib/roleRedirect';
import { supabase } from '../../lib/supabase';
import type { ShopProduct } from '../../stores/ecommerceCatalogStore';

type BrowseMode = 'products' | 'wholesale' | 'stores';

const CATEGORY_ICONS = [
  Smartphone,
  Shirt,
  Home,
  ShoppingBag,
  Baby,
  Utensils,
  Laptop,
  Package,
];

function categoryIcon(index: number) {
  return CATEGORY_ICONS[index % CATEGORY_ICONS.length];
}

export const MarketplacePage: React.FC = () => {
  const { ensureCompanies } = useMarketplaceBootstrap();

  const companies = useEcommerceCatalogStore((s) => s.companies);
  const companiesLoading = useEcommerceCatalogStore((s) => s.companiesLoading);
  const companiesError = useEcommerceCatalogStore((s) => s.companiesError);
  const marketplaceProducts = useEcommerceCatalogStore((s) => s.marketplaceProducts);
  const marketplaceLoading = useEcommerceCatalogStore((s) => s.marketplaceLoading);
  const marketplaceError = useEcommerceCatalogStore((s) => s.marketplaceError);
  const categories = useEcommerceCatalogStore((s) => s.categories);
  const selectedCategory = useEcommerceCatalogStore((s) => s.selectedCategory);
  const searchQuery = useEcommerceCatalogStore((s) => s.searchQuery);
  const setSelectedCategory = useEcommerceCatalogStore((s) => s.setSelectedCategory);

  const sortBy = useMarketplaceUiStore((s) => s.sortBy);
  const stockFilter = useMarketplaceUiStore((s) => s.stockFilter);
  const minPrice = useMarketplaceUiStore((s) => s.minPrice);
  const maxPrice = useMarketplaceUiStore((s) => s.maxPrice);
  const sessionId = useEcommerceCatalogStore((s) => s.sessionId);

  const [browseMode, setBrowseMode] = React.useState<BrowseMode>('products');
  const [recentlyViewed, setRecentlyViewed] = React.useState<ShopProduct[]>([]);
  const [bannerIndex, setBannerIndex] = React.useState(0);
  const [customerName, setCustomerName] = React.useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    if (browseMode === 'stores') ensureCompanies();
  }, [browseMode, ensureCompanies]);

  React.useEffect(() => {
    void shopApi.getRecentlyViewed(sessionId).then((res) => {
      setRecentlyViewed(res.data ?? []);
    });
  }, [sessionId]);

  React.useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setIsLoggedIn(false);
        setCustomerName(null);
        return;
      }
      setIsLoggedIn(true);
      const metaName =
        (session.user.user_metadata?.full_name as string | undefined) ||
        session.user.email?.split('@')[0] ||
        'there';
      setCustomerName(metaName);
    });
  }, []);

  React.useEffect(() => {
    const t = window.setInterval(() => setBannerIndex((i) => (i + 1) % 3), 5000);
    return () => window.clearInterval(t);
  }, []);

  const filteredStores = companies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const productPool =
    browseMode === 'wholesale'
      ? marketplaceProducts.filter(isWholesaleProduct)
      : marketplaceProducts;

  const filteredProducts = useMemo(() => {
    const base = productPool.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.company_name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        !selectedCategory || productMatchesCategoryFilter(p, selectedCategory);
      return matchesSearch && matchesCategory;
    });
    return applyProductFilters(base, { sortBy, stockFilter, minPrice, maxPrice });
  }, [productPool, searchQuery, selectedCategory, sortBy, stockFilter, minPrice, maxPrice]);

  const isLoading =
    browseMode === 'stores'
      ? companiesLoading && companies.length === 0
      : marketplaceLoading && marketplaceProducts.length === 0;

  const showProductGrid = browseMode === 'products' || browseMode === 'wholesale';

  const banners = [
    {
      title: 'Latest trending products',
      subtitle: 'Shop retail finds from neighbourhood stores',
      cta: 'Shop now',
      onClick: () => setBrowseMode('products'),
    },
    {
      title: 'Wholesale deals',
      subtitle: 'Stock up for your business at better prices',
      cta: 'View wholesale',
      onClick: () => setBrowseMode('wholesale'),
    },
    {
      title: 'Official stores',
      subtitle: 'Browse trusted sellers near you',
      cta: 'See stores',
      onClick: () => setBrowseMode('stores'),
    },
  ];
  const activeBanner = banners[bannerIndex];

  const popularCats = categories.slice(0, 8);
  const deals = filteredProducts.slice(0, 10);

  return (
    <div className="space-y-4 pb-2">
      {/* Hero: sidebar | banner | user card */}
      <section className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_200px] gap-3">
        <aside className="jm-hero-panel hidden lg:block">
          <nav className="py-1 max-h-[17rem] overflow-y-auto scrollbar-thin">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setBrowseMode('products');
              }}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 border-b border-border/60 ${
                !selectedCategory ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-secondary'
              }`}
            >
              <Grid3X3 className="w-4 h-4 shrink-0" />
              All categories
            </button>
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setBrowseMode('products');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm capitalize border-b border-border/40 flex items-center justify-between gap-2 ${
                    active
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
            {categories.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">Categories loading…</p>
            )}
          </nav>
        </aside>

        <div className="jm-hero-slide text-white p-5 sm:p-7 flex flex-col justify-end relative">
          <div key={bannerIndex} className="mk-rise relative z-10 max-w-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              Featured
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight">
              {activeBanner.title}
            </h1>
            <p className="mt-2 text-sm text-white/90">{activeBanner.subtitle}</p>
            <button
              type="button"
              onClick={activeBanner.onClick}
              className="mt-4 inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-bold hover:brightness-110 transition"
            >
              {activeBanner.cta}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="relative z-10 flex gap-1.5 mt-5">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setBannerIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === bannerIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/45'
                }`}
              />
            ))}
          </div>
        </div>

        <aside className="jm-hero-panel p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                Hi, {customerName ?? 'user'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isLoggedIn ? 'Welcome back' : "let's get started"}
              </p>
            </div>
          </div>
          {!isLoggedIn ? (
            <div className="grid grid-cols-2 gap-2">
              <Link
                to={shopRoutes.customerSignup()}
                className="text-center text-xs font-bold rounded-lg bg-primary text-primary-foreground py-2 hover:brightness-110"
              >
                Join now
              </Link>
              <Link
                to={shopRoutes.customerLogin()}
                className="text-center text-xs font-bold rounded-lg border border-border py-2 hover:bg-secondary"
              >
                Log in
              </Link>
            </div>
          ) : (
            <Link
              to={shopRoutes.account}
              className="text-center text-xs font-bold rounded-lg bg-primary text-primary-foreground py-2 hover:brightness-110"
            >
              My account
            </Link>
          )}
          <div className="rounded-lg bg-gradient-to-br from-accent to-primary text-white p-3 mt-auto">
            <p className="text-xs font-semibold opacity-90">Get started</p>
            <p className="text-sm font-bold mt-0.5 leading-snug">
              Shop local stores — retail & wholesale
            </p>
            <Link
              to={shopRoutes.categories}
              className="inline-flex mt-2 text-[11px] font-bold underline underline-offset-2"
            >
              Browse categories
            </Link>
          </div>
        </aside>
      </section>

      {/* Popular categories */}
      <section className="jm-hero-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">Popular categories</h2>
            <Link to={shopRoutes.categories} className="text-xs font-semibold text-primary inline-flex items-center">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            <Link
              to={shopRoutes.categories}
              className="jm-cat-icon flex flex-col items-center gap-2 rounded-xl p-2"
            >
              <span className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Grid3X3 className="w-6 h-6" />
              </span>
              <span className="text-[11px] font-medium text-center">All</span>
            </Link>
            {popularCats.map((cat, index) => {
              const Icon = categoryIcon(index);
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(active ? null : cat);
                    setBrowseMode('products');
                  }}
                  className={`jm-cat-icon flex flex-col items-center gap-2 rounded-xl p-2 ${
                    active ? 'bg-primary/10' : ''
                  }`}
                >
                  <span
                    className={`w-14 h-14 rounded-full flex items-center justify-center ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </span>
                  <span className="text-[11px] font-medium text-center capitalize line-clamp-2">
                    {cat}
                  </span>
                </button>
              );
            })}
          </div>
      </section>

      <PromotedProductsStrip />

      {/* Deals of the day */}
      {showProductGrid && deals.length > 0 && (
        <section className="jm-hero-panel overflow-hidden">
          <div className="jm-flash-bar px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <Zap className="w-4 h-4 fill-current" />
              Deals of the day
            </div>
            <button
              type="button"
              onClick={() => setBrowseMode('products')}
              className="text-[11px] font-semibold text-white/95 inline-flex items-center"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 p-3">
            {deals.map((product, index) => (
              <div
                key={`deal-${product.company_id}-${product.id}`}
                className="mk-product-enter"
                style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
              >
                <ShopProductCard
                  product={product}
                  companyId={product.company_id ?? ''}
                  companyName={product.company_name ?? 'Store'}
                  showStoreName
                  size="compact"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dual promo banners */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setBrowseMode('products')}
          className="relative overflow-hidden rounded-xl min-h-[9rem] text-left text-white p-5"
          style={{
            background:
              'linear-gradient(105deg, hsl(var(--primary) / 0.92), hsl(var(--primary) / 0.55)), url(https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80) center/cover',
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Promo</p>
          <p className="text-xl font-extrabold mt-1">Shop products</p>
          <p className="text-sm text-white/90 mt-1">Discover what stores have in stock</p>
          <span className="inline-flex mt-3 text-xs font-bold bg-white text-foreground rounded-lg px-3 py-1.5">
            Browse now
          </span>
        </button>
        <button
          type="button"
          onClick={() => setBrowseMode('wholesale')}
          className="relative overflow-hidden rounded-xl min-h-[9rem] text-left text-white p-5"
          style={{
            background:
              'linear-gradient(105deg, hsl(var(--accent) / 0.92), hsl(var(--accent) / 0.5)), url(https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80) center/cover',
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Business</p>
          <p className="text-xl font-extrabold mt-1">Wholesale hub</p>
          <p className="text-sm text-white/90 mt-1">Better prices when you buy in bulk</p>
          <span className="inline-flex mt-3 text-xs font-bold bg-white text-foreground rounded-lg px-3 py-1.5">
            View wholesale
          </span>
        </button>
      </section>

      {recentlyViewed.length > 0 && browseMode === 'products' && (
        <section className="jm-hero-panel p-3 space-y-2">
          <h2 className="text-sm font-bold text-foreground">Recently viewed</h2>
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
            {recentlyViewed.slice(0, 10).map((product) => (
              <div key={`${product.company_id}-${product.id}`} className="shrink-0 w-[5.25rem]">
                <ShopProductCard
                  product={product}
                  companyId={product.company_id ?? ''}
                  companyName={product.company_name ?? 'Store'}
                  size="mini"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full catalog */}
      <section className="jm-hero-panel overflow-hidden">
        <div className="flex border-b border-border">
          {(
            [
              { id: 'products' as const, label: 'Products', icon: Package },
              { id: 'wholesale' as const, label: 'Wholesale', icon: Tags },
              { id: 'stores' as const, label: 'Stores', icon: Store },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setBrowseMode(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                browseMode === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-3 space-y-3">
          {showProductGrid && <MarketplaceToolbar />}

          {browseMode === 'stores' && companiesError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {companiesError}
            </div>
          )}
          {browseMode !== 'stores' && marketplaceError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {marketplaceError}
            </div>
          )}

          <div key={browseMode} className="mk-catalog-swap">
            {browseMode === 'stores' ? (
              isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-secondary" />
                  ))}
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No stores found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredStores.map((company, index) => (
                    <div
                      key={company.id}
                      className="mk-product-enter"
                      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                    >
                      <StoreCard company={company} />
                    </div>
                  ))}
                </div>
              )
            ) : isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-secondary" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {browseMode === 'wholesale' ? 'No wholesale products found.' : 'No products found.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {filteredProducts.map((product, index) => (
                  <div
                    key={`${product.company_id}-${product.id}`}
                    data-tour={index === 0 ? 'shop-product-card' : undefined}
                    className="mk-product-enter"
                    style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                  >
                    <ShopProductCard
                      product={product}
                      companyId={product.company_id ?? ''}
                      companyName={product.company_name ?? 'Store'}
                      showStoreName
                      size="compact"
                      preferWholesalePrice={browseMode === 'wholesale'}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
