import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Search, Radio, Star } from 'lucide-react';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import { ShopProductCard } from '../../components/shop/ShopProductCard';
import { ProductRatingStars } from '../../components/shop/ProductRatingStars';
import { useShopRealtime } from '../../hooks/shop/useShopRealtime';
import { useStoreCatalog } from '../../hooks/shop/useMarketplaceBootstrap';
import { shopApi } from '../../lib/shopApi';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/Button';
import { toast } from 'sonner';

export const StorePage: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const searchQuery = useEcommerceCatalogStore((s) => s.searchQuery);
  const setSearchQuery = useEcommerceCatalogStore((s) => s.setSearchQuery);

  const { company, products, loading, updated, refreshSilent } = useStoreCatalog(companyId);

  const [sellerRating, setSellerRating] = useState({ average_rating: 0, rating_count: 0 });
  const [ratingInput, setRatingInput] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [canRateSeller, setCanRateSeller] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    void shopApi.getSellerRatings(companyId).then((res) => {
      setSellerRating({
        average_rating: res.data.average_rating,
        rating_count: res.data.rating_count,
      });
    });
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      setCanRateSeller(profile?.role === 'customer');
    });
  }, [companyId]);

  const submitSellerRating = async () => {
    if (!companyId) return;
    try {
      await shopApi.submitSellerRating(companyId, {
        rating: ratingInput,
        comment: ratingComment.trim() || undefined,
      });
      toast.success('Thanks for your feedback!');
      const res = await shopApi.getSellerRatings(companyId);
      setSellerRating({
        average_rating: res.data.average_rating,
        rating_count: res.data.rating_count,
      });
      setRatingComment('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit rating');
    }
  };

  useShopRealtime(companyId, refreshSilent);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!companyId) return null;

  return (
    <div className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All stores
      </Link>

      <div className="glass-card overflow-hidden">
        {company?.banner_url ? (
          <div className="relative h-32 sm:h-40 md:h-48">
            <img
              src={company.banner_url}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end gap-3">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt=""
                  className="w-14 h-14 rounded-xl border-2 border-background object-cover shadow-md shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-primary/20 border-2 border-background flex items-center justify-center text-xl font-bold text-primary shrink-0">
                  {(company?.name ?? 'S').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h1 className="text-lg font-bold text-foreground">{company?.name ?? 'Store'}</h1>
                    {company?.location && (
                      <p className="text-xs text-muted-foreground mt-0.5">{company.location}</p>
                    )}
                  </div>
                  {updated && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Radio className="w-3 h-3 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover border border-border shrink-0"
                  />
                ) : null}
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-foreground">{company?.name ?? 'Store'}</h1>
                  {company?.location && (
                    <p className="text-xs text-muted-foreground mt-0.5">{company.location}</p>
                  )}
                </div>
              </div>
              {updated && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {(sellerRating.rating_count > 0 || canRateSeller) && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Seller reputation</h2>
            {sellerRating.rating_count > 0 && (
              <ProductRatingStars
                rating={sellerRating.average_rating}
                count={sellerRating.rating_count}
              />
            )}
          </div>
          {canRateSeller && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Rate this store</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatingInput(n)}
                    className="p-1"
                    aria-label={`${n} stars`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        n <= ratingInput ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <input
                className="input-modern py-2 text-sm w-full"
                placeholder="Comment (optional)"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
              <Button size="sm" onClick={() => void submitSellerRating()}>
                Submit rating
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search products…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-modern pl-9 py-2 text-sm w-full"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-card aspect-[3/4] animate-pulse bg-secondary/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <ShopProductCard
              key={product.id}
              product={product}
              companyId={companyId}
              companyName={company?.name ?? 'Store'}
              size="compact"
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No products in this store yet.</p>
      )}
    </div>
  );
};
