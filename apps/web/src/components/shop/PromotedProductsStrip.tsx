import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ChevronRight } from 'lucide-react';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import { ProductImage } from './ProductImage';
import { trackProductClick } from '../../hooks/shop/useMarketplaceBootstrap';
import { shopRoutes } from '../../lib/roleRedirect';

export const PromotedProductsStrip: React.FC = () => {
  const promotions = useEcommerceCatalogStore((s) => s.promotions);

  if (promotions.length === 0) return null;

  return (
    <section className="jm-hero-panel overflow-hidden">
      <div className="jm-flash-bar px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-sm">
          <Zap className="w-4 h-4 fill-current" />
          Recommended for you
        </div>
        <Link
          to={shopRoutes.categories}
          className="text-[11px] font-semibold text-white/95 inline-flex items-center"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto p-3 scrollbar-thin">
        {promotions.map((product, index) => {
          const companyId = product.company_id ?? '';
          const url = `/product/${companyId}/${product.id}`;
          return (
            <Link
              key={`${companyId}-${product.id}`}
              to={url}
              className="mk-product-enter shrink-0 w-[108px] flex flex-col gap-1.5 group"
              style={{ animationDelay: `${index * 35}ms` }}
              onClick={() =>
                trackProductClick({
                  productId: product.id,
                  companyId,
                  category: product.category,
                })
              }
            >
              <div className="w-[108px] h-[108px] rounded-lg bg-secondary/80 border border-border/60 overflow-hidden transition-transform duration-200 group-hover:-translate-y-0.5">
                <ProductImage
                  imageUrl={product.image_url}
                  name={product.name}
                  className="w-full h-full object-cover"
                  iconClassName="text-lg opacity-40"
                />
              </div>
              <p className="text-[11px] text-left line-clamp-2 leading-tight text-foreground font-medium">
                {product.name}
              </p>
              <p className="text-sm font-bold text-primary text-left tabular-nums">
                ₵{Number(product.price).toFixed(2)}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
