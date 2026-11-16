import React from 'react';
import { Link } from 'react-router-dom';
import type { ShopProduct } from '../../stores/ecommerceCatalogStore';
import { ProductImage } from './ProductImage';
import { trackProductClick } from '../../hooks/shop/useMarketplaceBootstrap';

interface CategoryProductTileProps {
  product: ShopProduct;
  companyId: string;
}

export const CategoryProductTile: React.FC<CategoryProductTileProps> = ({ product, companyId }) => {
  const productUrl = `/product/${companyId}/${product.id}`;

  return (
    <Link
      to={productUrl}
      className="flex flex-col items-center gap-1.5 group"
      onClick={() =>
        trackProductClick({
          productId: product.id,
          companyId,
          category: product.category,
        })
      }
    >
      <div className="w-full aspect-square rounded-lg bg-secondary/90 border border-border/60 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-primary/30 transition-all">
        <ProductImage
          imageUrl={product.image_url}
          name={product.name}
          className="w-full h-full object-cover"
          iconClassName="text-xl opacity-40"
        />
      </div>
      <p className="text-[10px] text-center text-foreground line-clamp-2 leading-tight px-0.5">
        {product.name}
      </p>
    </Link>
  );
};
