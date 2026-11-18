import React, { useMemo, useState } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { Button } from '../../Button';
import { Input } from '../../Input';
import { ProductImage } from '../../shop/ProductImage';
import { Globe, Package, Pencil, RefreshCw, Search, Store } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';
import type { Product } from '../../../hooks/useDashboardData';

interface OnlineItemsTabProps {
  companyId: string;
  products: Product[];
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onEditProduct: (product: Product) => void;
  onProductsChanged?: () => void | Promise<void>;
}

export const OnlineItemsTab: React.FC<OnlineItemsTabProps> = ({
  companyId,
  products,
  loading = false,
  onRefresh,
  onEditProduct,
  onProductsChanged,
}) => {
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => Boolean(p.is_online_listing))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q)
        );
      });
  }, [products, query]);

  const notListedCount = useMemo(
    () => products.filter((p) => !p.is_online_listing).length,
    [products],
  );

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success('Online items refreshed');
    } catch {
      toast.error('Could not refresh online items');
    } finally {
      setRefreshing(false);
    }
  };

  const unlistProduct = async (product: Product) => {
    setBusyId(product.id);
    const toastId = toast.loading(`Unlisting ${product.name}…`);
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_online_listing: false })
        .eq('id', product.id)
        .eq('company_id', companyId);
      if (error) throw error;
      toast.success('Removed from marketplace', {
        id: toastId,
        description: `${product.name} is no longer listed online`,
      });
      await onProductsChanged?.();
    } catch (err) {
      toast.error('Unlist failed', {
        id: toastId,
        description: err instanceof Error ? err.message : 'Could not unlist product',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Online Items"
        subtitle="Products currently listed on the marketplace"
        secondaryAction={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-sky-600" />
            Listed online
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {products.filter((p) => p.is_online_listing).length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Catalog total
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">{products.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-amber-600" />
            Not listed yet
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">{notListedCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Open Warehouse → Edit to list them online
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search listed products…"
          className="!pl-9"
        />
      </div>

      {loading && listed.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground animate-pulse">
          Loading online items…
        </div>
      ) : listed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-2">
          <Globe className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="font-medium text-foreground">No marketplace listings yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            When adding or editing a warehouse product, turn on “List as online marketplace product”
            to show it here and in the shop.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Category</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listed.map((product) => (
                  <tr key={product.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-secondary shrink-0">
                          <ProductImage
                            imageUrl={product.image_url}
                            name={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {product.sku || 'No SKU'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground capitalize">
                      {(product.category || '—').replace('/', ' · ')}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums whitespace-nowrap">
                      ₵{Number(product.price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          onClick={() => onEditProduct(product)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === product.id}
                          onClick={() => void unlistProduct(product)}
                        >
                          Unlist
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
