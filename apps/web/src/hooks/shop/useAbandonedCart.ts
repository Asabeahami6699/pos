import { useEffect, useRef } from 'react';
import { useEcommerceCartStore } from '../../stores/ecommerceCartStore';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import { shopApi } from '../../lib/shopApi';

/** Sync cart to server for abandoned-cart recovery (when email known). */
export function useAbandonedCartSync(email?: string | null) {
  const items = useEcommerceCartStore((s) => s.items);
  const sessionId = useEcommerceCatalogStore((s) => s.sessionId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (items.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void shopApi.syncAbandonedCart({
        session_id: sessionId,
        email: email ?? undefined,
        cart: items,
      });
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, sessionId, email]);
}
