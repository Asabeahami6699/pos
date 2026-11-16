import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Package, ChevronRight } from 'lucide-react';
import type { ShopCompany } from '../../stores/ecommerceCatalogStore';

interface StoreCardProps {
  company: ShopCompany;
}

export const StoreCard: React.FC<StoreCardProps> = ({ company }) => {
  const initial = company.name.charAt(0).toUpperCase();

  return (
    <Link to={`/store/${company.id}`} className="mk-product-card p-3 flex items-center gap-3 group">
      {company.logo_url ? (
        <img
          src={company.logo_url}
          alt=""
          className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
          {company.name}
        </h3>
        {company.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            {company.location}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
          <Package className="w-3 h-3" />
          {company.product_count ?? 0} products
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
    </Link>
  );
};
