import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useShopChatUiStore } from '../../stores/shopChatUiStore';
import { shopRoutes } from '../../lib/roleRedirect';

/**
 * Legacy /chat/:companyId route — opens the floating chat room and returns to the shop.
 */
export const ShopChatRoomPage: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const companyName =
    (location.state as { companyName?: string } | null)?.companyName ?? 'Store';

  useEffect(() => {
    if (companyId) {
      useShopChatUiStore.getState().openRoom(companyId, companyName);
    }
    navigate(shopRoutes.home, { replace: true });
  }, [companyId, companyName, navigate]);

  return (
    <div className="text-center py-16 text-sm text-muted-foreground animate-pulse">
      Opening chat…
    </div>
  );
};
