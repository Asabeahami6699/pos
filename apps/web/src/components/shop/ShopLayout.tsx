import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  ShoppingCart,
  User,
  LayoutGrid,
  Heart,
  MessageCircle,
  Package,
} from 'lucide-react';
import {
  selectCartTotalItems,
  useEcommerceCartStore,
} from '../../stores/ecommerceCartStore';
import { shopRoutes, STAFF_LOGIN_PATH } from '../../lib/roleRedirect';
import { ShopChatWidget } from './ShopChatWidget';
import { SearchAutocomplete } from './SearchAutocomplete';
import { MarketplaceNotificationBell } from './MarketplaceNotificationBell';
import { useMarketplaceBootstrap } from '../../hooks/shop/useMarketplaceBootstrap';
import { useCustomerNotifications } from '../../hooks/shop/useCustomerNotifications';
import { initAnalytics, trackPageView } from '../../lib/marketplaceAnalytics';
import { useAbandonedCartSync } from '../../hooks/shop/useAbandonedCart';
import { supabase } from '../../lib/supabase';
import { ProductTour } from '../onboarding/ProductTour';
import { useOnboardingTourStore } from '../../stores/onboardingTourStore';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';

function isNavActive(pathname: string, to: string): boolean {
  if (to === shopRoutes.home) return pathname === shopRoutes.home;
  if (to === shopRoutes.categories) return pathname.startsWith('/categories');
  if (to === shopRoutes.account) {
    return pathname.startsWith('/account') || pathname.startsWith('/orders');
  }
  return pathname.startsWith(to);
}

export const ShopLayout: React.FC = () => {
  useMarketplaceBootstrap();
  const { unreadCount: notificationUnread } = useCustomerNotifications();

  const location = useLocation();
  const navigate = useNavigate();
  const tourHydrated = useOnboardingTourStore((s) => s.hydrated);
  const tourCompleted = useOnboardingTourStore((s) => s.completed.marketplace);
  const startTour = useOnboardingTourStore((s) => s.startTour);
  const categories = useEcommerceCatalogStore((s) => s.categories);
  const selectedCategory = useEcommerceCatalogStore((s) => s.selectedCategory);
  const setSelectedCategory = useEcommerceCatalogStore((s) => s.setSelectedCategory);
  const searchQuery = useEcommerceCatalogStore((s) => s.searchQuery);
  const [searchActive, setSearchActive] = useState(false);
  const handleSearchActive = useCallback((active: boolean) => {
    setSearchActive(active);
  }, []);

  useEffect(() => {
    initAnalytics();
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!tourHydrated || tourCompleted) return;
    const timer = window.setTimeout(() => startTour('marketplace'), 800);
    return () => window.clearTimeout(timer);
  }, [tourHydrated, tourCompleted, startTour]);

  const items = useEcommerceCartStore((s) => s.items);
  const totalItems = useMemo(() => selectCartTotalItems(items), [items]);
  const [syncEmail, setSyncEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSyncEmail(session?.user?.email ?? null);
    });
  }, []);

  useAbandonedCartSync(syncEmail);

  const isChatRoom = location.pathname.startsWith('/chat');
  const isAccountArea = location.pathname.startsWith('/account');
  const hideShopChrome = isAccountArea;
  const hideFloatingChat = isChatRoom;

  const navItems = useMemo(() => {
    return [
      { to: shopRoutes.home, label: 'Home', icon: Home, tourId: 'shop-home' },
      { to: shopRoutes.categories, label: 'Category', icon: LayoutGrid, tourId: 'shop-categories' },
      { to: '/wishlist', label: 'Saved', icon: Heart },
      { to: shopRoutes.cart, label: 'Cart', icon: ShoppingCart, badge: totalItems || undefined, tourId: 'shop-cart' },
      { to: shopRoutes.account, label: 'Account', icon: User, tourId: 'shop-account' },
    ];
  }, [totalItems]);

  const secondaryLinks = [
    { to: shopRoutes.home, label: 'Hot offers' },
    { to: shopRoutes.categories, label: 'Categories' },
    { to: shopRoutes.home, label: 'Wholesale' },
    { to: '/wishlist', label: 'Saved' },
    { to: shopRoutes.orders, label: 'Orders' },
    { to: '/help/faq', label: 'Help' },
  ];

  const submitSearch = () => {
    if (location.pathname !== shopRoutes.home) {
      navigate(shopRoutes.home);
    }
  };

  return (
    <div
      className={`marketplace-shell page-shell flex flex-col min-h-[100dvh] max-md:h-[100dvh] md:min-h-screen ${
        searchActive ? 'max-md:overflow-visible' : 'max-md:overflow-hidden'
      }`}
    >
      {!hideShopChrome && (
        <>
          <header
            className={`sticky top-0 mk-header safe-area-pt ${
              searchActive ? 'z-50' : 'z-30'
            }`}
          >
            <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-2.5 pb-2 relative">
              <div className={`flex items-center gap-3 ${searchActive ? 'max-md:gap-2' : ''}`}>
                <Link
                  to={shopRoutes.home}
                  data-tour="shop-home"
                  className={`shrink-0 leading-none ${searchActive ? 'max-md:hidden' : ''}`}
                >
                  <span className="mk-display text-xl sm:text-2xl font-extrabold text-primary tracking-tight">
                    Marketplace
                  </span>
                  <span className="text-primary font-extrabold text-xl sm:text-2xl">.</span>
                </Link>

                <div
                  className={`jm-search-bar flex-1 min-w-0 transition-all duration-200 ${
                    searchActive
                      ? 'jm-search-bar-active max-w-none md:max-w-none'
                      : 'max-w-3xl'
                  }`}
                >
                  <select
                    className="hidden sm:block shrink-0 bg-secondary/70 text-xs font-medium px-2.5 border-r border-border outline-none max-w-[8.5rem]"
                    value={selectedCategory ?? ''}
                    onChange={(e) => setSelectedCategory(e.target.value || null)}
                    aria-label="Search category"
                  >
                    <option value="">All category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <div className="flex-1 min-w-0">
                    <SearchAutocomplete
                      onActiveChange={handleSearchActive}
                      className="[&_input]:rounded-none [&_input]:border-0 [&_input]:h-11 [&_input]:bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={submitSearch}
                    className={`jm-search-submit items-center ${
                      searchActive ? 'inline-flex' : 'hidden sm:inline-flex'
                    }`}
                  >
                    Search
                  </button>
                </div>

                <div
                  className={`hidden md:flex items-center gap-1 ml-auto ${
                    searchActive ? 'md:opacity-40 md:pointer-events-none' : ''
                  }`}
                >
                  <Link
                    to={shopRoutes.account}
                    data-tour="shop-account"
                    className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] ${
                      isNavActive(location.pathname, shopRoutes.account)
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    Profile
                  </Link>
                  <MarketplaceNotificationBell />
                  <Link
                    to={shopRoutes.chat}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] text-muted-foreground hover:bg-secondary"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Message
                  </Link>
                  <Link
                    to={shopRoutes.orders}
                    className="relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] text-muted-foreground hover:bg-secondary"
                  >
                    <Package className="w-5 h-5" />
                    Orders
                    {notificationUnread > 0 && (
                      <span className="absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 rounded-md bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {notificationUnread > 99 ? '99+' : notificationUnread}
                      </span>
                    )}
                  </Link>
                  <Link
                    to={shopRoutes.cart}
                    data-tour="shop-cart"
                    className={`relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] ${
                      isNavActive(location.pathname, shopRoutes.cart)
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    My cart
                    {totalItems > 0 && (
                      <span className="absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 rounded-md bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {totalItems}
                      </span>
                    )}
                  </Link>
                </div>

                <Link
                  to={shopRoutes.cart}
                  className={`md:hidden relative p-2 rounded-lg bg-secondary ${
                    searchActive ? 'hidden' : ''
                  }`}
                  aria-label="Cart"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 px-1 rounded-md flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            <div className="hidden md:block border-t border-border/70">
              <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto scrollbar-thin text-sm">
                <Link
                  to={shopRoutes.categories}
                  className="inline-flex items-center gap-1.5 font-semibold text-foreground shrink-0"
                >
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  All category
                </Link>
                {secondaryLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="text-muted-foreground hover:text-primary shrink-0 whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to={STAFF_LOGIN_PATH}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground shrink-0"
                >
                  Staff login
                </Link>
              </div>
            </div>
          </header>
        </>
      )}

      <main
        className={`flex-1 w-full mx-auto min-h-0 max-md:overflow-y-auto flex flex-col ${
          isChatRoom
            ? 'p-0 max-w-none max-md:overflow-hidden'
            : isAccountArea
              ? 'max-w-none w-full p-0'
              : 'max-w-6xl py-3 safe-area-px'
        }`}
      >
        <div className="flex-1 min-h-0 flex flex-col w-full">
          <Outlet />
        </div>
      </main>

      {!hideFloatingChat && <ShopChatWidget />}

      {!hideShopChrome && (
        <footer className="hidden md:block border-t border-border bg-card mt-6">
          <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 rounded-xl bg-secondary/60 p-4">
              <p className="font-bold text-foreground">Stay updated</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Get deals and new arrivals from local stores.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email"
                  className="input-modern flex-1 h-10 text-sm"
                  aria-label="Newsletter email"
                />
                <button type="button" className="jm-search-submit rounded-lg px-4">
                  Subscribe
                </button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p className="font-bold text-foreground mb-2">About</p>
              <Link to="/help/about" className="block hover:text-primary">About us</Link>
              <Link to="/help/faq" className="block hover:text-primary">Find store</Link>
              <Link to={STAFF_LOGIN_PATH} className="block hover:text-primary">Sell with us</Link>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p className="font-bold text-foreground mb-2">Information</p>
              <Link to="/help/shipping" className="block hover:text-primary">Shipping</Link>
              <Link to="/help/returns" className="block hover:text-primary">Returns</Link>
              <Link to="/help/faq" className="block hover:text-primary">Help Center</Link>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p className="font-bold text-foreground mb-2">For users</p>
              <Link to={shopRoutes.customerLogin()} className="block hover:text-primary">Login</Link>
              <Link to={shopRoutes.customerSignup()} className="block hover:text-primary">Register</Link>
              <Link to={shopRoutes.account} className="block hover:text-primary">Settings</Link>
            </div>
          </div>
          <div className="border-t border-border py-3 text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Marketplace · {searchQuery ? `Searching “${searchQuery}”` : 'Shop local stores'}
          </div>
        </footer>
      )}

      <ProductTour
        onStepChange={({ route }) => {
          if (route && location.pathname !== route) {
            navigate(route);
          }
        }}
      />

      {!isChatRoom && (
        <div className="shop-nav-dock md:hidden">
          <nav className="liquid-glass-nav" aria-label="Marketplace navigation">
            <div className="flex justify-around gap-0.5">
              {navItems.map(({ to, label, icon: Icon, badge, tourId }) => {
                const active = isNavActive(location.pathname, to);
                return (
                  <Link
                    key={to}
                    to={to}
                    data-tour={tourId}
                    className={`relative flex flex-col items-center gap-0 px-1.5 py-1 text-[9px] min-w-0 flex-1 rounded-xl transition-colors ${
                      active
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-full leading-tight">{label}</span>
                    {badge ? (
                      <span className="absolute top-1 right-2 bg-primary text-primary-foreground text-[9px] font-bold min-w-[16px] h-4 rounded-md flex items-center justify-center px-1">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};
