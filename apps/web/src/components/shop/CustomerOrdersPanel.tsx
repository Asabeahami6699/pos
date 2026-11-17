import React, { useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Truck,
  RotateCcw,
  MapPin,
  Phone,
  User,
  Hash,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { shopApi } from '../../lib/shopApi';
import { useEcommerceOrdersStore, type CustomerOrder } from '../../stores/ecommerceOrdersStore';
import { OrderItemRating } from './OrderItemRating';
import { ProductImage } from './ProductImage';
import { Button } from '../Button';
import { toast } from 'sonner';
import { orderNumberFromId } from '../../lib/orderTrackingNumber';

const RATEABLE_STATUSES = new Set(['delivered', 'shipped']);
const RETURNABLE_STATUSES = new Set(['delivered', 'shipped']);

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-800',
  confirmed: 'bg-blue-500/15 text-blue-800',
  processing: 'bg-indigo-500/15 text-indigo-800',
  ready: 'bg-cyan-500/15 text-cyan-800',
  shipped: 'bg-purple-500/15 text-purple-800',
  delivered: 'bg-emerald-500/15 text-emerald-800',
  cancelled: 'bg-destructive/15 text-destructive',
};

interface CustomerOrdersPanelProps {
  embedded?: boolean;
  onAuthChange?: (signedIn: boolean) => void;
}

function itemCount(order: CustomerOrder): number {
  return (order.online_order_items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function lineCount(order: CustomerOrder): number {
  return order.online_order_items?.length ?? 0;
}

function itemUnitPrice(item: { unit_price?: number; total_price?: number; quantity: number }): number {
  if (typeof item.unit_price === 'number') return item.unit_price;
  if (typeof item.total_price === 'number' && item.quantity > 0) {
    return item.total_price / item.quantity;
  }
  return 0;
}

function itemLineTotal(item: { unit_price?: number; total_price?: number; quantity: number }): number {
  if (typeof item.total_price === 'number') return item.total_price;
  return itemUnitPrice(item) * item.quantity;
}

export const CustomerOrdersPanel: React.FC<CustomerOrdersPanelProps> = ({
  embedded = false,
  onAuthChange,
}) => {
  const orders = useEcommerceOrdersStore((s) => s.orders);
  const loading = useEcommerceOrdersStore((s) => s.loading);
  const setOrders = useEcommerceOrdersStore((s) => s.setOrders);
  const setLoading = useEcommerceOrdersStore((s) => s.setLoading);
  const updateOrderStatus = useEcommerceOrdersStore((s) => s.updateOrderStatus);

  const [signedIn, setSignedIn] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [returnOrderId, setReturnOrderId] = React.useState<string | null>(null);
  const [returnReason, setReturnReason] = React.useState('');
  const [returnSubmitting, setReturnSubmitting] = React.useState(false);
  const [returnsByOrder, setReturnsByOrder] = React.useState<
    Record<string, { status: string; reason: string }>
  >({});

  const loadReturns = useCallback(async () => {
    try {
      const res = await shopApi.getReturnRequests();
      const map: Record<string, { status: string; reason: string }> = {};
      for (const row of (res.data ?? []) as Array<{
        order_id: string;
        status: string;
        reason: string;
      }>) {
        map[row.order_id] = { status: row.status, reason: row.reason };
      }
      setReturnsByOrder(map);
    } catch {
      /* optional */
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setSignedIn(false);
        onAuthChange?.(false);
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'customer') {
        setSignedIn(false);
        onAuthChange?.(false);
        return;
      }

      setSignedIn(true);
      onAuthChange?.(true);
      const res = await shopApi.getMyOrders();
      const next = (res.data as CustomerOrder[]) ?? [];
      setOrders(next);
      setSelectedId((prev) => {
        if (prev && next.some((o) => o.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
      await loadReturns();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setOrders, onAuthChange, loadReturns]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!signedIn) return;

    const channel = supabase
      .channel(embedded ? 'customer-online-orders-embedded' : 'customer-online-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'online_orders' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const row = payload.new as { id: string; status: string };
            updateOrderStatus(row.id, row.status);
          } else {
            loadOrders();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [signedIn, loadOrders, updateOrderStatus, embedded]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? orders[0] ?? null,
    [orders, selectedId],
  );

  const submitReturn = async (order: CustomerOrder) => {
    if (!returnReason.trim()) {
      toast.error('Please describe the reason for return');
      return;
    }
    setReturnSubmitting(true);
    try {
      await shopApi.createReturnRequest({
        order_id: order.id,
        reason: returnReason.trim(),
        items: (order.online_order_items ?? []).map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });
      toast.success('Return request submitted');
      setReturnOrderId(null);
      setReturnReason('');
      await loadReturns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit return');
    } finally {
      setReturnSubmitting(false);
    }
  };

  if (!signedIn && !loading) {
    return (
      <div className="glass-card p-6 text-center text-sm text-muted-foreground">
        Sign in to view your orders.
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground animate-pulse text-sm">
        Loading orders…
      </div>
    );
  }

  if (!loading && orders.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No orders yet.</p>
        <Link to="/" className="inline-block mt-3">
          <Button size="sm">Start shopping</Button>
        </Link>
      </div>
    );
  }

  const renderOrderActions = (order: CustomerOrder) => {
    const canRate = RATEABLE_STATUSES.has(order.status);
    const existingReturn = returnsByOrder[order.id];

    return (
      <>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link to={`/orders/${order.id}/track`}>
            <Button size="sm" variant="secondary">
              <Truck className="w-3.5 h-3.5 mr-1 inline" />
              Track
            </Button>
          </Link>
          {RETURNABLE_STATUSES.has(order.status) && !existingReturn && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReturnOrderId(order.id);
                setReturnReason('');
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 inline" />
              Request return
            </Button>
          )}
        </div>

        {existingReturn && (
          <p className="text-[10px] text-muted-foreground bg-secondary/50 rounded-md px-2 py-1 capitalize">
            Return: <strong>{existingReturn.status}</strong>
          </p>
        )}

        {returnOrderId === order.id && (
          <div className="pt-2 border-t border-border space-y-2">
            <textarea
              className="input-modern py-2 text-sm min-h-[72px] w-full"
              placeholder="Why are you returning this order?"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" loading={returnSubmitting} onClick={() => void submitReturn(order)}>
                Submit request
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setReturnOrderId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {canRate && order.online_order_items && order.online_order_items.length > 0 && (
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-foreground">Rate your purchase</p>
            {order.online_order_items.map((item) => (
              <OrderItemRating
                key={`${order.id}-${item.product_id}`}
                companyId={order.company_id}
                productId={item.product_id}
                productName={item.product_name}
                onRated={loadOrders}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  const renderDetail = (order: CustomerOrder) => {
    const units = itemCount(order);
    const lines = lineCount(order);
    const items = order.online_order_items ?? [];

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {order.companies?.name ?? 'Store'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(order.created_at).toLocaleString()} · #{orderNumberFromId(order.id)}
            </p>
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
              STATUS_STYLES[order.status] ?? 'bg-secondary text-foreground'
            }`}
          >
            {order.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-secondary/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Items</p>
            <p className="text-sm font-bold tabular-nums text-foreground">
              {units} <span className="font-medium text-muted-foreground">unit{units === 1 ? '' : 's'}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {lines} line{lines === 1 ? '' : 's'}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="text-sm font-bold tabular-nums text-primary">
              ₵{Number(order.total).toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fulfillment</p>
            <p className="text-sm font-semibold capitalize text-foreground">
              {order.fulfillment_type || 'delivery'}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payment</p>
            <p className="text-sm font-semibold capitalize text-foreground">
              {(order.payment_method || 'pay_on_delivery').replace(/_/g, ' ')}
            </p>
            {order.payment_status && (
              <p className="text-[10px] text-muted-foreground capitalize">{order.payment_status}</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Order items
          </h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-secondary/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-center px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Unit</th>
                  <th className="text-right px-3 py-2 font-medium">Line</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, i) => (
                  <tr key={`${item.product_id}-${i}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-lg border border-border bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                          <ProductImage
                            imageUrl={item.image_url}
                            name={item.product_name}
                            className="w-full h-full object-cover"
                            iconClassName="text-base opacity-40"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-xs sm:text-sm truncate">
                            {item.product_name}
                          </p>
                          {(item.sku || item.barcode) && (
                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                              {item.barcode || item.sku}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-semibold">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      ₵{itemUnitPrice(item).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      ₵{itemLineTotal(item).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/40">
                  <td className="px-3 py-2.5 text-xs font-semibold" colSpan={2}>
                    {units} item{units === 1 ? '' : 's'} total
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground hidden sm:table-cell">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-primary tabular-nums">
                    ₵{Number(order.total).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Delivery details
            </p>
            {order.shipping_name && (
              <p className="flex items-center gap-1.5 text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                {order.shipping_name}
              </p>
            )}
            {order.shipping_phone && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                {order.shipping_phone}
              </p>
            )}
            {order.shipping_address && (
              <p className="flex items-start gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{order.shipping_address}</span>
              </p>
            )}
            {!order.shipping_name && !order.shipping_address && (
              <p className="text-muted-foreground">No shipping details on file.</p>
            )}
          </div>
          <div className="rounded-xl border border-border p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Tracking
            </p>
            {order.tracking_number ? (
              <p className="flex items-start gap-1.5 font-mono text-foreground break-all">
                <Hash className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  {order.carrier_name ? `${order.carrier_name}: ` : ''}
                  {order.tracking_number}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">Tracking will appear when the store ships.</p>
            )}
            {order.notes && (
              <p className="text-muted-foreground pt-1 border-t border-border">
                Note: {order.notes}
              </p>
            )}
          </div>
        </div>

        {renderOrderActions(order)}
      </div>
    );
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-4 lg:items-start">
      {/* Order list */}
      <div className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
        {orders.map((order) => {
          const units = itemCount(order);
          const active = selectedOrder?.id === order.id;
          return (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedId(order.id)}
              className={`w-full text-left glass-card p-3 transition-colors ${
                active
                  ? 'ring-2 ring-primary/40 bg-primary/5'
                  : 'hover:bg-secondary/50 lg:hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-12 h-12 rounded-lg border border-border bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                  <ProductImage
                    imageUrl={order.online_order_items?.[0]?.image_url}
                    name={order.online_order_items?.[0]?.product_name ?? 'Order'}
                    className="w-full h-full object-cover"
                    iconClassName="text-sm opacity-40"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {order.companies?.name ?? 'Store'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()} · #{orderNumberFromId(order.id)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        STATUS_STYLES[order.status] ?? 'bg-secondary'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {units} item{units === 1 ? '' : 's'}
                  {order.fulfillment_type ? ` · ${order.fulfillment_type}` : ''}
                </span>
                <span className="font-bold text-primary tabular-nums">
                  ₵{Number(order.total).toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground lg:hidden">
                <span className="inline-flex items-center gap-0.5">
                  {active ? 'Showing details below' : 'Tap to review items'}
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail pane — side panel on desktop, below list on mobile */}
      <div className="glass-card p-4 sm:p-5 lg:sticky lg:top-24 mt-2 lg:mt-0">
        {selectedOrder ? (
          renderDetail(selectedOrder)
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">
            Select an order to review items and details.
          </p>
        )}
      </div>
    </div>
  );
};
