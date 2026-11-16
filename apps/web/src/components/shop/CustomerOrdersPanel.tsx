import React, { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { shopApi } from '../../lib/shopApi';
import { useEcommerceOrdersStore, type CustomerOrder } from '../../stores/ecommerceOrdersStore';
import { OrderItemRating } from './OrderItemRating';
import { Button } from '../Button';
import { toast } from 'sonner';

const RATEABLE_STATUSES = new Set(['delivered', 'shipped']);
const RETURNABLE_STATUSES = new Set(['delivered', 'shipped']);

interface CustomerOrdersPanelProps {
  embedded?: boolean;
  onAuthChange?: (signedIn: boolean) => void;
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
      setOrders((res.data as CustomerOrder[]) ?? []);
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

  return (
    <div className="space-y-3">
      {loading && orders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground animate-pulse text-sm">Loading orders…</div>
      )}

      {!loading && orders.length === 0 && (
        <div className="glass-card p-6 text-center">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No orders yet.</p>
          <Link to="/" className="inline-block mt-3">
            <Button size="sm">Start shopping</Button>
          </Link>
        </div>
      )}

      {orders.map((order) => {
        const canRate = RATEABLE_STATUSES.has(order.status);
        const existingReturn = returnsByOrder[order.id];

        return (
          <div key={order.id} className="glass-card p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-sm font-semibold">{order.companies?.name ?? 'Store'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()} · #{order.id.slice(-8)}
                </p>
                {order.fulfillment_type && (
                  <p className="text-[10px] text-muted-foreground capitalize">{order.fulfillment_type}</p>
                )}
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary capitalize">
                {order.status}
              </span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {order.online_order_items?.map((item, i) => (
                <li key={i}>
                  {item.product_name} × {item.quantity}
                </li>
              ))}
            </ul>
            <p className="text-sm font-bold text-primary tabular-nums">₵{Number(order.total).toFixed(2)}</p>

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
          </div>
        );
      })}
    </div>
  );
};
