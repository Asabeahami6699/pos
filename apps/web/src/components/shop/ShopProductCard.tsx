import React from 'react';
import { Link } from 'react-router-dom';
import type { ShopProduct } from '../../stores/ecommerceCatalogStore';
import { useEcommerceCartStore } from '../../stores/ecommerceCartStore';
import { trackProductClick } from '../../hooks/shop/useMarketplaceBootstrap';
import { ProductRatingStars } from './ProductRatingStars';
import { ProductImage } from './ProductImage';
import { WishlistButton } from './WishlistButton';
import { useCompareStore } from '../../stores/compareStore';
import { toast } from 'sonner';
import { GitCompare } from 'lucide-react';
import { Button } from '../Button';
import {
  getDefaultPriceType,
  getPriceForType,
  productHasWholesalePrice,
  type ShopPriceType,
} from '../../lib/shopProductPricing';

export type ShopProductCardSize = 'default' | 'compact' | 'mini';

interface ShopProductCardProps {
  product: ShopProduct;
  companyId: string;
  companyName: string;
  showStoreName?: boolean;
  /** @deprecated use size="compact" */
  compact?: boolean;
  size?: ShopProductCardSize;
  showAddToCart?: boolean;
  preferWholesalePrice?: boolean;
}

export const ShopProductCard: React.FC<ShopProductCardProps> = ({
  product,
  companyId,
  companyName,
  showStoreName = false,
  compact = false,
  size: sizeProp,
  showAddToCart,
  preferWholesalePrice = false,
}) => {
  const size: ShopProductCardSize = sizeProp ?? (compact ? 'compact' : 'default');
  const isMini = size === 'mini';
  const isCompact = size === 'compact' || isMini;

  const addItem = useEcommerceCartStore((s) => s.addItem);
  const compareHas = useCompareStore((s) => s.has(product.id));
  const compareAdd = useCompareStore((s) => s.add);
  const compareRemove = useCompareStore((s) => s.remove);
  const productUrl = `/product/${companyId}/${product.id}`;
  const priceType: ShopPriceType = getDefaultPriceType(product, preferWholesalePrice);
  const displayPrice = getPriceForType(product, priceType);
  const showCart = showAddToCart ?? !isMini;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.in_stock) return;
    addItem({
      companyId,
      companyName,
      productId: product.id,
      name: product.name,
      sku: product.sku ?? '',
      price: displayPrice,
      priceType,
      maxStock: product.stock,
      imageUrl: product.image_url ?? undefined,
      category: product.category,
    });
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (compareHas) {
      compareRemove(product.id);
      return;
    }
    const ok = compareAdd(product, companyId, companyName);
    if (!ok) toast.error('Compare list is full (max 4)');
  };

  const imageClass = isMini
    ? 'aspect-square max-h-[64px]'
    : isCompact
      ? 'aspect-square'
      : 'aspect-square mb-2';

  const cardPad = isMini ? 'p-1.5' : isCompact ? 'p-2' : 'p-3';

  return (
    <div className={`mk-product-card flex flex-col h-full ${cardPad}`}>
      <Link
        to={productUrl}
        className="block group"
        onClick={() =>
          trackProductClick({
            productId: product.id,
            companyId,
            category: product.category,
          })
        }
      >
        <div
          className={`mk-card-media relative w-full overflow-hidden bg-secondary/80 flex items-center justify-center ${imageClass} ${isCompact ? 'mb-1.5' : ''}`}
        >
          <ProductImage imageUrl={product.image_url} name={product.name} />
          {!product.in_stock && !isMini && (
            <span className="absolute left-1 top-1 text-[9px] font-bold bg-foreground/70 text-background px-1.5 py-0.5 rounded-md">
              Out of stock
            </span>
          )}
          {!isMini && (
            <div className="absolute top-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <WishlistButton
                productId={product.id}
                companyId={companyId}
                className="!p-1 !rounded-md bg-card/95 border border-border/50"
              />
              <button
                type="button"
                onClick={handleCompare}
                className={`p-1 rounded-md bg-card/95 border border-border/50 ${
                  compareHas ? 'text-primary' : 'text-muted-foreground'
                }`}
                aria-label="Compare"
              >
                <GitCompare className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {showStoreName && !isMini && (
          <p className="text-[10px] text-primary font-semibold truncate mb-0.5">{companyName}</p>
        )}
        <h3
          className={`text-foreground group-hover:text-primary transition-colors ${
            isMini
              ? 'text-[10px] leading-tight line-clamp-1'
              : isCompact
                ? 'text-[11px] leading-snug line-clamp-2 min-h-[2rem] font-medium'
                : 'text-sm line-clamp-2 min-h-[2.5rem] font-medium'
          }`}
        >
          {product.name}
        </h3>
      </Link>

      {!isMini && ((product.rating_count ?? 0) > 0 || (product.average_rating ?? 0) > 0) ? (
        <div className={isCompact ? 'mt-0.5 scale-[0.85] origin-left' : 'mt-1'}>
          <ProductRatingStars
            rating={product.average_rating ?? 0}
            count={product.rating_count ?? 0}
          />
        </div>
      ) : null}

      <p
        className={`font-bold tabular-nums ${
          isMini ? 'text-[10px] mt-0.5' : isCompact ? 'text-sm mt-1' : 'text-base mt-1.5'
        }`}
      >
        <span className="text-primary">₵{displayPrice.toFixed(2)}</span>
        {!isMini && priceType === 'wholesale' && productHasWholesalePrice(product) && (
          <span className="ml-1 text-[9px] font-semibold uppercase text-muted-foreground">
            wholesale
          </span>
        )}
      </p>

      {!isCompact && (
        <p className={`text-[11px] mt-1 ${product.in_stock ? 'text-emerald-600' : 'text-destructive'}`}>
          {product.in_stock ? `${product.stock} in stock` : 'Out of stock'}
        </p>
      )}

      {showCart && (
        <div className={`mt-auto ${isCompact ? 'pt-1.5' : 'pt-2'}`}>
          <Button
            size="sm"
            fullWidth
            onClick={handleAdd}
            disabled={!product.in_stock}
            className={
              isCompact
                ? 'mk-add-btn text-[11px] h-8 px-2 !rounded-lg'
                : 'mk-add-btn text-xs !rounded-lg'
            }
          >
            Add to cart
          </Button>
        </div>
      )}
    </div>
  );
};
