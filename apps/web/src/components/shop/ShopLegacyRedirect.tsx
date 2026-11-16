import { Navigate, useLocation } from 'react-router-dom';

/** Redirect old /shop/* URLs to new root marketplace paths */
export function ShopLegacyRedirect() {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/shop\/?/, '');
  const target = rest ? `/${rest}` : '/';
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}
