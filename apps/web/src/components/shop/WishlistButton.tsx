import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useWishlistStore } from '../../stores/wishlistStore';
import { shopApi } from '../../lib/shopApi';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface WishlistButtonProps {
  productId: string;
  companyId: string;
  className?: string;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({
  productId,
  companyId,
  className = '',
}) => {
  const has = useWishlistStore((s) => s.has(productId));
  const toggle = useWishlistStore((s) => s.toggle);
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !has;
    toggle(productId, companyId);
    setBusy(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (next) toast.info('Sign in to sync wishlist across devices');
        return;
      }
      if (next) await shopApi.addWishlist(productId, companyId);
      else await shopApi.removeWishlist(productId);
    } catch {
      toggle(productId, companyId);
      toast.error('Could not update wishlist');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`p-1.5 rounded-full bg-background/80 border border-border shadow-sm hover:bg-secondary ${className}`}
      aria-label={has ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart className={`w-4 h-4 ${has ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
    </button>
  );
};
