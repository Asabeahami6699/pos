import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import { useWishlistStore } from '../../stores/wishlistStore';
import { ShopProductCard } from '../../components/shop/ShopProductCard';
import { SeoHead } from '../../components/shop/SeoHead';
import type { ShopProduct } from '../../stores/ecommerceCatalogStore';
import { supabase } from '../../lib/supabase';

export const WishlistPage: React.FC = () => {
  const localItems = useWishlistStore((s) => s.items);
  const [products, setProducts] = useState<
    Array<{ product: ShopProduct; companyId: string; companyName: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await shopApi.getWishlist();
          const rows = (res.data ?? []) as Array<{
            product_id: string;
            company_id: string;
            products: ShopProduct;
            companies?: { name: string };
          }>;
          setProducts(
            rows.map((r) => ({
              product: { ...r.products, company_id: r.company_id, stock: r.products.stock ?? 0, in_stock: true },
              companyId: r.company_id,
              companyName: r.companies?.name ?? 'Store',
            })),
          );
        } else {
          const all = await shopApi.getAllProducts();
          const map = new Map(all.data.map((p) => [`${p.company_id}:${p.id}`, p]));
          setProducts(
            localItems
              .map((i) => {
                const p = map.get(`${i.companyId}:${i.productId}`);
                if (!p) return null;
                return {
                  product: p,
                  companyId: i.companyId,
                  companyName: p.company_name ?? 'Store',
                };
              })
              .filter(Boolean) as typeof products,
          );
        }
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [localItems]);

  return (
    <div className="space-y-4">
      <SeoHead title="Wishlist" description="Your saved products" />
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Heart className="w-5 h-5 text-red-500" />
        Wishlist
      </h1>

      {loading && <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>}

      {!loading && products.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No saved items yet. Tap the heart on any product.
          <div className="mt-3">
            <Link to="/" className="text-primary hover:underline">
              Browse marketplace
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map(({ product, companyId, companyName }) => (
          <ShopProductCard
            key={`${companyId}-${product.id}`}
            product={product}
            companyId={companyId}
            companyName={companyName}
            showStoreName
            size="compact"
            showAddToCart={false}
          />
        ))}
      </div>
    </div>
  );
};
