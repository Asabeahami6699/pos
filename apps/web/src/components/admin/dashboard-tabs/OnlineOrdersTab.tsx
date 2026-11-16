import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { Button } from '../../Button';
import {
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Package,
  Phone,
  MapPin,
  User,
  CheckCircle,
  Truck,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, type AdminOnlineOrder, type AdminOnlineOrderStatus, type AdminReturnRequest } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

interface OnlineOrdersTabProps {
  companyId?: string | null;
}

type OrderFilter = 'all' | AdminOnlineOrderStatus;

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'ready', label: 'Ready' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  confirmed: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  processing: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  ready: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  shipped: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  delivered: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  cancelled: 'bg-destructive/15 text-destructive',
};

function nextActions(status: AdminOnlineOrderStatus): Array<{
  status: AdminOnlineOrderStatus;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}> {
  switch (status) {
    case 'pending':
      return [
        { status: 'confirmed', label: 'Confirm order', variant: 'primary' },
        { status: 'cancelled', label: 'Cancel', variant: 'danger' },
      ];
    case 'confirmed':
      return [
        { status: 'processing', label: 'Start processing', variant: 'primary' },
        { status: 'ready', label: 'Mark ready', variant: 'primary' },
        { status: 'cancelled', label: 'Cancel', variant: 'danger' },
      ];
    case 'processing':
      return [
        { status: 'ready', label: 'Mark ready', variant: 'primary' },
        { status: 'shipped', label: 'Mark shipped', variant: 'primary' },
      ];
    case 'ready':
      return [
        { status: 'shipped', label: 'Mark shipped', variant: 'primary' },
        { status: 'delivered', label: 'Mark delivered', variant: 'primary' },
      ];
    case 'shipped':
      return [{ status: 'delivered', label: 'Mark delivered', variant: 'primary' }];
    default:
      return [];
  }
}

export const OnlineOrdersTab: React.FC<OnlineOrdersTabProps> = ({ companyId }) => {
  const [orders, setOrders] = useState<AdminOnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderFilter>('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<Record<string, { carrier: string; number: string }>>({});
  const [returns, setReturns] = useState<AdminReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [updatingReturnId, setUpdatingReturnId] = useState<string | null>(null);

  useEffect(() => {
    void api.getAdminReturnRequests().then((res) => setReturns(res.data ?? [])).catch(() => {});
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminOnlineOrders(filter);
      setOrders(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load online orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`admin-online-orders:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'online_orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          loadOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, loadOrders]);

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === 'pending').length,
    [orders],
  );

  const handleStatusUpdate = async (orderId: string, status: AdminOnlineOrderStatus) => {
    setUpdatingId(orderId);
    try {
      await api.updateAdminOnlineOrderStatus(orderId, { status });
      toast.success(`Order ${status}`);
      await loadOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const loadReturns = useCallback(async () => {
    setReturnsLoading(true);
    try {
      const res = await api.getAdminReturnRequests();
      setReturns(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load returns');
      setReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showReturns) loadReturns();
  }, [showReturns, loadReturns]);

  const handleSaveTracking = async (order: AdminOnlineOrder) => {
    const draft = trackingDraft[order.id] ?? {
      carrier: order.carrier_name ?? '',
      number: order.tracking_number ?? '',
    };
    setUpdatingId(order.id);
    try {
      await api.updateAdminOnlineOrderStatus(order.id, {
        carrier_name: draft.carrier.trim(),
        tracking_number: draft.number.trim(),
      });
      toast.success('Tracking saved');
      await loadOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save tracking');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReturnUpdate = async (returnId: string, status: AdminReturnRequest['status']) => {
    setUpdatingReturnId(returnId);
    try {
      await api.updateAdminReturnRequest(returnId, { status });
      toast.success(`Return ${status}`);
      await loadReturns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setUpdatingReturnId(null);
    }
  };

  const marketplaceUrl = companyId ? `/store/${companyId}` : '/';

  return (
    <div>
      <DashboardHeader
        title="Online shop orders"
        subtitle="Marketplace orders from customers — confirm and fulfil them here"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
          <span>
            Warehouse products are listed on the marketplace.
            {filter === 'pending' && pendingCount > 0 && (
              <strong className="text-foreground ml-1">{pendingCount} pending</strong>
            )}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowReturns((v) => !v)}
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Returns{returns.filter((r) => r.status === 'pending').length > 0 ? ` (${returns.filter((r) => r.status === 'pending').length})` : ''}
          </Button>
          <a href={marketplaceUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              View store
            </Button>
          </a>
          <Button variant="secondary" size="sm" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showReturns && (
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-semibold">Return requests</h3>
          {returnsLoading && <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>}
          {!returnsLoading && returns.length === 0 && (
            <p className="text-xs text-muted-foreground glass-card p-4">No return requests.</p>
          )}
          {returns.map((ret) => (
            <div key={ret.id} className="glass-card p-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span>
                  Order #{ret.order_id.slice(-8)} · {ret.online_orders?.shipping_name ?? 'Customer'}
                </span>
                <span className="capitalize px-2 py-0.5 rounded-full bg-secondary">{ret.status}</span>
              </div>
              <p className="text-muted-foreground">{ret.reason}</p>
              {ret.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    loading={updatingReturnId === ret.id}
                    onClick={() => handleReturnUpdate(ret.id, 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={updatingReturnId === ret.id}
                    onClick={() => handleReturnUpdate(ret.id, 'rejected')}
                    className="text-destructive"
                  >
                    Reject
                  </Button>
                </div>
              )}
              {ret.status === 'approved' && (
                <Button
                  size="sm"
                  loading={updatingReturnId === ret.id}
                  onClick={() => handleReturnUpdate(ret.id, 'refunded')}
                >
                  Mark refunded
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No online orders in this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const actions = nextActions(order.status);
            const isUpdating = updatingId === order.id;

            return (
              <div key={order.id} className="glass-card p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Order #{order.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] ?? 'bg-secondary'}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <User className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{order.shipping_name ?? '—'}</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{order.shipping_phone ?? '—'}</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{order.shipping_address ?? '—'}</span>
                  </div>
                </div>

                <ul className="text-xs border-t border-border pt-2 space-y-1">
                  {order.online_order_items?.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.product_name} × {item.quantity}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        ₵{Number(item.total_price).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-sm font-bold text-primary tabular-nums">
                    Total ₵{Number(order.total).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {order.payment_method.replace(/_/g, ' ')}
                    {order.fulfillment_type ? ` · ${order.fulfillment_type}` : ''}
                  </p>
                </div>

                {order.notes && (
                  <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2">
                    Note: {order.notes}
                  </p>
                )}

                {['confirmed', 'processing', 'ready', 'shipped', 'delivered'].includes(order.status) && (
                  <div className="flex flex-wrap gap-2 items-end pt-1 border-t border-border">
                    <input
                      className="input-modern py-1.5 text-xs h-8 flex-1 min-w-[6rem]"
                      placeholder="Carrier"
                      value={trackingDraft[order.id]?.carrier ?? order.carrier_name ?? ''}
                      onChange={(e) =>
                        setTrackingDraft((prev) => ({
                          ...prev,
                          [order.id]: {
                            carrier: e.target.value,
                            number: prev[order.id]?.number ?? order.tracking_number ?? '',
                          },
                        }))
                      }
                    />
                    <input
                      className="input-modern py-1.5 text-xs h-8 flex-1 min-w-[8rem]"
                      placeholder="Tracking number"
                      value={trackingDraft[order.id]?.number ?? order.tracking_number ?? ''}
                      onChange={(e) =>
                        setTrackingDraft((prev) => ({
                          ...prev,
                          [order.id]: {
                            carrier: prev[order.id]?.carrier ?? order.carrier_name ?? '',
                            number: e.target.value,
                          },
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={isUpdating}
                      onClick={() => handleSaveTracking(order)}
                    >
                      Save tracking
                    </Button>
                  </div>
                )}

                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                    {actions.map((action) => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={action.variant === 'danger' ? 'secondary' : action.variant ?? 'secondary'}
                        loading={isUpdating}
                        disabled={isUpdating}
                        onClick={() => handleStatusUpdate(order.id, action.status)}
                        className={
                          action.variant === 'danger'
                            ? 'text-destructive border-destructive/30'
                            : action.variant === 'primary'
                              ? ''
                              : ''
                        }
                      >
                        {action.status === 'confirmed' && <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                        {action.status === 'shipped' && <Truck className="w-3.5 h-3.5 mr-1" />}
                        {action.status === 'cancelled' && <XCircle className="w-3.5 h-3.5 mr-1" />}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
