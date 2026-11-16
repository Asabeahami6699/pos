import React from 'react';
import { Link } from 'react-router-dom';
import { GitCompare, X } from 'lucide-react';
import { useCompareStore } from '../../stores/compareStore';
import { SeoHead } from '../../components/shop/SeoHead';
import { Button } from '../../components/Button';

export const ComparePage: React.FC = () => {
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);

  return (
    <div className="space-y-4">
      <SeoHead title="Compare products" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          Compare ({items.length}/4)
        </h1>
        {items.length > 0 && (
          <Button variant="secondary" size="sm" onClick={clear}>
            Clear all
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Add up to 4 products from listings to compare side by side.
          <div className="mt-3">
            <Link to="/" className="text-primary hover:underline">
              Browse products
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left p-2 border-b border-border">Product</th>
                {items.map((p) => (
                  <th key={p.id} className="p-2 border-b border-border text-left min-w-[140px]">
                    <div className="flex items-start justify-between gap-1">
                      <Link to={`/product/${p.companyId}/${p.id}`} className="font-medium hover:text-primary line-clamp-2">
                        {p.name}
                      </Link>
                      <button type="button" onClick={() => remove(p.id)} aria-label="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 text-muted-foreground">Store</td>
                {items.map((p) => (
                  <td key={p.id} className="p-2">{p.companyName}</td>
                ))}
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Price</td>
                {items.map((p) => (
                  <td key={p.id} className="p-2 font-semibold text-primary">₵{p.price.toFixed(2)}</td>
                ))}
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Stock</td>
                {items.map((p) => (
                  <td key={p.id} className="p-2">{p.in_stock ? `${p.stock} avail` : 'Out'}</td>
                ))}
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Rating</td>
                {items.map((p) => (
                  <td key={p.id} className="p-2">
                    {(p.average_rating ?? 0) > 0
                      ? `${(p.average_rating ?? 0).toFixed(1)} (${p.rating_count ?? 0})`
                      : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
