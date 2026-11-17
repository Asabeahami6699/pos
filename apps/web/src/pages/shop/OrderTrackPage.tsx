import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Package, RefreshCw } from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import { SeoHead } from '../../components/shop/SeoHead';
import { ProductImage } from '../../components/shop/ProductImage';
import { AccountSectionLayout } from '../../components/shop/AccountSectionLayout';
import { Button } from '../../components/Button';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  ready: 'Ready for pickup',
};

type TrackingData = {
  order: Record<string, unknown> & {
    online_order_items?: Array<{
      product_name: string;
      quantity: number;
      unit_price: number;
      image_url?: string | null;
    }>;
  };
  events: Array<Record<string, unknown>>;
};

export const OrderTrackPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? localStorage.getItem(`guest-order-${orderId}`) ?? undefined;

  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    shopApi
      .getOrderTracking(orderId, token)
      .then((res) => setData(res.data as TrackingData))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tracking'))
      .finally(() => setLoading(false));
  }, [orderId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const order = data?.order;
  const events = data?.events ?? [];
  const items = order?.online_order_items ?? [];
  const orderLabel = orderId ? `#${orderId.slice(-8)}` : 'Order';

  return (
    <AccountSectionLayout
      title={order ? `Order ${orderLabel}` : 'Track order'}
      subtitle={
        order
          ? `Status: ${STATUS_LABELS[String(order.status)] ?? String(order.status)}`
          : 'Live order status and timeline'
      }
      backTo="/orders"
      backLabel="Back to orders"
      actions={
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      }
    >
      <SeoHead title="Track order" />

      {loading && !order && (
        <p className="text-sm animate-pulse text-muted-foreground">Loading tracking…</p>
      )}
      {error && <div className="glass-card p-4 text-sm text-destructive">{error}</div>}

      {order && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4 items-start">
          <div className="glass-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Order {orderLabel}</h2>
            </div>
            <p className="text-sm capitalize">
              Status:{' '}
              <strong>{STATUS_LABELS[String(order.status)] ?? String(order.status)}</strong>
            </p>
            {order.estimated_delivery_date && (
              <p className="text-xs text-muted-foreground">
                Est. delivery:{' '}
                {new Date(String(order.estimated_delivery_date)).toLocaleDateString()}
              </p>
            )}
            {order.tracking_number && (
              <p className="text-xs">
                {String(order.carrier_name ?? 'Carrier')}:{' '}
                <strong>{String(order.tracking_number)}</strong>
              </p>
            )}

            {items.length > 0 && (
              <ul className="border-t border-border pt-3 space-y-3">
                {items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-12 h-12 rounded-lg border border-border bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                        <ProductImage
                          imageUrl={item.image_url}
                          name={item.product_name}
                          className="w-full h-full object-cover"
                          iconClassName="text-xs opacity-40"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">
                          {item.product_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          × {item.quantity} · ₵{Number(item.unit_price).toFixed(2)} each
                        </span>
                      </span>
                    </span>
                    <span className="tabular-nums shrink-0 text-sm font-semibold">
                      ₵{(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-base font-bold text-primary tabular-nums border-t border-border pt-3">
              Total ₵{Number(order.total).toFixed(2)}
            </p>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold mb-3">Timeline</h2>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tracking events yet.</p>
            ) : (
              <ol className="space-y-4 border-l-2 border-primary/30 pl-4">
                {events.map((ev) => (
                  <li key={String(ev.id)} className="relative">
                    <span className="absolute -left-[1.35rem] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                    <p className="text-sm font-medium capitalize">
                      {STATUS_LABELS[String(ev.status)] ?? String(ev.status)}
                    </p>
                    {ev.message && (
                      <p className="text-xs text-muted-foreground">{String(ev.message)}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(String(ev.created_at)).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </AccountSectionLayout>
  );
};
