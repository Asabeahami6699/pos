// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import CompanyDashboard from './pages/admin/CompanyDashboard';
import SellPage from './pages/pos/SellPage';
import { ThemedToaster } from './components/ui/ThemedToaster';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ShopLayout } from './components/shop/ShopLayout';
import { MarketplaceLanding } from './components/shop/MarketplaceLanding';
import { ShopLegacyRedirect } from './components/shop/ShopLegacyRedirect';
import { StorePage } from './pages/shop/StorePage';
import { CartPage } from './pages/shop/CartPage';
import { CheckoutPage } from './pages/shop/CheckoutPage';
import { CustomerAccountPage } from './pages/shop/CustomerAccountPage';
import { AccountProfilePage } from './pages/shop/account/AccountProfilePage';
import { AccountOrdersPage } from './pages/shop/account/AccountOrdersPage';
import { AccountAddressesPage } from './pages/shop/account/AccountAddressesPage';
import { AccountPaymentPage } from './pages/shop/account/AccountPaymentPage';
import { AccountReviewsPage } from './pages/shop/account/AccountReviewsPage';
import { AccountSettingsPage } from './pages/shop/account/AccountSettingsPage';
import { AccountInboxPage } from './pages/shop/account/AccountInboxPage';
import { AccountNotificationsPage } from './pages/shop/account/AccountNotificationsPage';
import { CustomerOrdersPage } from './pages/shop/CustomerOrdersPage';
import { ProductDetailPage } from './pages/shop/ProductDetailPage';
import { CategoriesPage } from './pages/shop/CategoriesPage';
import { ShopChatRoomPage } from './pages/shop/ShopChatRoomPage';
import { CustomerChatHubPage } from './pages/shop/CustomerChatHubPage';
import { CustomerLoginPage } from './pages/shop/auth/CustomerLoginPage';
import { CustomerSignupPage } from './pages/shop/auth/CustomerSignupPage';
import { WishlistPage } from './pages/shop/WishlistPage';
import { ComparePage } from './pages/shop/ComparePage';
import { OrderTrackPage } from './pages/shop/OrderTrackPage';
import { PoliciesPage } from './pages/shop/PoliciesPage';
import { STAFF_LOGIN_PATH } from './lib/roleRedirect';

function App() {
  return (
    <Router>
      <ThemedToaster />
      <Routes>
        {/* Marketplace landing (public) */}
        <Route path="/" element={<ShopLayout />}>
          <Route index element={<MarketplaceLanding />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="categories/:categorySlug" element={<CategoriesPage />} />
          <Route path="store/:companyId" element={<StorePage />} />
          <Route path="product/:companyId/:productId" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<CustomerOrdersPage />} />
          <Route path="account" element={<CustomerAccountPage />} />
          <Route path="account/notifications" element={<AccountNotificationsPage />} />
          <Route path="account/inbox" element={<AccountInboxPage />} />
          <Route path="account/profile" element={<AccountProfilePage />} />
          <Route path="account/orders" element={<AccountOrdersPage />} />
          <Route path="account/addresses" element={<AccountAddressesPage />} />
          <Route path="account/payment" element={<AccountPaymentPage />} />
          <Route path="account/reviews" element={<AccountReviewsPage />} />
          <Route path="account/settings" element={<AccountSettingsPage />} />
          <Route path="chat" element={<CustomerChatHubPage />} />
          <Route path="chat/:companyId" element={<ShopChatRoomPage />} />
          <Route path="auth/login" element={<CustomerLoginPage />} />
          <Route path="auth/signup" element={<CustomerSignupPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="orders/:orderId/track" element={<OrderTrackPage />} />
          <Route path="help/:slug" element={<PoliciesPage />} />
        </Route>

        <Route path="/shop/*" element={<ShopLegacyRedirect />} />

        <Route path={STAFF_LOGIN_PATH} element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/super-admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute allowedRoles={['company_admin', 'super_admin']}>
              <CompanyDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pos/salespersonPage"
          element={
            <ProtectedRoute allowedRoles={['salesperson']}>
              <SellPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
