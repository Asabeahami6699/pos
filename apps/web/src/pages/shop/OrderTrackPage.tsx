import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import { SeoHead } from '../../components/shop/SeoHead';
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

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <SeoHead title="Track order" />
      <div className="flex items-center justify-between gap-2">
        <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </Link>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && !order && <p className="text-sm animate-pulse text-muted-foreground">Loading tracking…</p>}
      {error && <div className="glass-card p-4 text-sm text-destructive">{error}</div>}

      {order && (
        <>
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Order #{String(order.id).slice(-8)}</h1>
            </div>
            <p className="text-sm capitalize">
              Status: <strong>{STATUS_LABELS[String(order.status)] ?? String(order.status)}</strong>
            </p>
            {order.estimated_delivery_date && (
              <p className="text-xs text-muted-foreground">
                Est. delivery: {new Date(String(order.estimated_delivery_date)).toLocaleDateString()}
              </p>
            )}
            {order.tracking_number && (
              <p className="text-xs">
                {String(order.carrier_name ?? 'Carrier')}: <strong>{String(order.tracking_number)}</strong>
              </p>
            )}
            {items.length > 0 && (
              <ul className="text-xs text-muted-foreground border-t border-border pt-2 space-y-0.5">
                {items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      {item.product_name} × {item.quantity}
                    </span>
                    <span className="tabular-nums">₵{(item.unit_price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm font-semibold text-primary tabular-nums">₵{Number(order.total).toFixed(2)}</p>
          </div>

          <div className="glass-card p-4">
            <h2 className="text-sm font-semibold mb-3">Timeline</h2>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tracking events yet.</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-primary/30 pl-4">
                {events.map((ev) => (
                  <li key={String(ev.id)} className="relative">
                    <span className="absolute -left-[1.35rem] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                    <p className="text-sm font-medium capitalize">
                      {STATUS_LABELS[String(ev.status)] ?? String(ev.status)}
                    </p>
                    {ev.message && <p className="text-xs text-muted-foreground">{String(ev.message)}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(String(ev.created_at)).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
};
