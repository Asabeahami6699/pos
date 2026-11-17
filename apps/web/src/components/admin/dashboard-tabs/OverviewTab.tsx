import React, { useEffect, useState } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { StatCard } from '../StatCard';
import { RealTimeIndicator } from '../RealTimeIndicator';
import { Button } from '../../Button';
import {
  Package,
  User,
  Building,
  Clock,
  ArrowRight,
  ShoppingBag,
  Wallet,
  CreditCard,
  CalendarClock,
  CheckCircle2,
  Circle,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  api,
  type AdminOnlineOrder,
  type PaystackPayoutSettings,
  type SubscriptionInfo,
} from '../../../lib/api';
import { formatPlanLabel } from '@pos-inventory/shared';

interface OverviewTabProps {
  companyName: string;
  companyId?: string | null;
  subscription?: SubscriptionInfo | null;
  inventoryModel?: 'warehouse' | 'branch_only';
  stats: {
    totalSales: number;
    totalProducts: number;
    lowStockCount: number;
    activeStaff: number;
    pendingRequests: number;
    totalRevenue: number;
    warehouseStock: number;
    allocationsCount: number;
  };
  branchCount?: number;
  staffCount?: number;
  restockRequests: any[];
  pendingOnlineOrders?: AdminOnlineOrder[];
  setProcessingRequest: (request: any) => void;
  setIsProcessRestockModalOpen: (open: boolean) => void;
  setIsAddWarehouseProductModalOpen: (open: boolean) => void;
  setIsBatchAllocationModalOpen: (open: boolean) => void;
  setIsAddBranchStockModalOpen?: (open: boolean) => void;
  setIsStaffModalOpen: (open: boolean) => void;
  setIsBranchModalOpen?: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  onReplayTour?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  companyName,
  companyId,
  subscription,
  inventoryModel = 'warehouse',
  stats,
  branchCount = 0,
  staffCount = 0,
  restockRequests,
  pendingOnlineOrders = [],
  setProcessingRequest,
  setIsProcessRestockModalOpen,
  setIsAddWarehouseProductModalOpen,
  setIsBatchAllocationModalOpen,
  setIsAddBranchStockModalOpen,
  setIsStaffModalOpen,
  setIsBranchModalOpen,
  setActiveTab,
  onReplayTour,
}) => {
  const isBranchOnly = inventoryModel === 'branch_only';
  const pendingRequests = restockRequests.filter(r => r.status === 'pending');
  const displayRequests = pendingRequests.slice(0, 3);
  const hasMoreThan3 = pendingRequests.length > 0 && pendingRequests.length > 3;
  const displayOnlineOrders = pendingOnlineOrders.slice(0, 3);
  const hasMoreOnlineOrders = pendingOnlineOrders.length > 3;

  const setupItems = [
    {
      id: 'branch',
      label: 'Create a branch',
      done: branchCount > 0,
      action: () => {
        setActiveTab('branches');
        setIsBranchModalOpen?.(true);
      },
    },
    {
      id: 'staff',
      label: 'Add staff',
      done: staffCount > 0,
      action: () => setIsStaffModalOpen(true),
    },
    {
      id: 'stock',
      label: isBranchOnly ? 'Add branch stock' : 'Add warehouse products',
      done: stats.totalProducts > 0 || stats.warehouseStock > 0,
      action: () =>
        isBranchOnly
          ? setIsAddBranchStockModalOpen?.(true)
          : setIsAddWarehouseProductModalOpen(true),
    },
    ...(!isBranchOnly
      ? [
          {
            id: 'allocate',
            label: 'Allocate stock to a branch',
            done: stats.allocationsCount > 0,
            action: () => setIsBatchAllocationModalOpen(true),
          },
        ]
      : []),
  ];
  const setupIncomplete = setupItems.some((i) => !i.done);
  const setupDoneCount = setupItems.filter((i) => i.done).length;

  const [onlineTotal, setOnlineTotal] = useState(0);
  const [payoutSettings, setPayoutSettings] = useState<PaystackPayoutSettings | null>(null);
  const onlinePending = pendingOnlineOrders.length;

  useEffect(() => {
    if (!companyId) return;
    void (async () => {
      try {
        const [{ data: orders }, payoutRes] = await Promise.all([
          supabase.from('online_orders').select('total').eq('company_id', companyId),
          api.getPaystackPayout().catch(() => null),
        ]);
        setOnlineTotal(orders?.reduce((sum, o) => sum + Number(o.total ?? 0), 0) ?? 0);
        if (payoutRes?.data) setPayoutSettings(payoutRes.data);
      } catch {
        /* non-blocking */
      }
    })();
  }, [companyId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <DashboardHeader
        title={`${companyName} Dashboard`}
        subtitle="Welcome back — live stock and sales updates are on"
        secondaryAction={
          onReplayTour ? (
            <Button variant="secondary" size="sm" onClick={onReplayTour} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Replay tour
            </Button>
          ) : undefined
        }
      />

      {setupIncomplete && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Setup checklist</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {setupDoneCount} of {setupItems.length} complete — finish these to go live
              </p>
            </div>
            {onReplayTour && (
              <button
                type="button"
                onClick={onReplayTour}
                className="text-xs font-medium text-primary hover:underline"
              >
                Guided walkthrough
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {setupItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-background/80 transition-colors"
                >
                  {item.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={`text-sm flex-1 ${
                      item.done ? 'text-muted-foreground line-through' : 'text-foreground font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                  {!item.done && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard 
          title="Total Revenue" 
          value={`₵${stats.totalRevenue.toFixed(2)}`} 
          icon="💰" 
          color="indigo"
          trend="POS + in-store sales"
        />
        <StatCard 
          title="Online shop revenue" 
          value={`₵${onlineTotal.toFixed(2)}`} 
          icon="🛒" 
          color="green"
          trend={`${onlinePending} pending fulfillment`}
          onClick={() => setActiveTab('online-orders')}
          clickable
        />
        <StatCard 
          title="Pending Requests" 
          value={stats.pendingRequests} 
          icon="📝" 
          color="orange"
          trend={`${pendingRequests.length} need attention`}
          onClick={() => setActiveTab('requests')}
          clickable
        />
        <StatCard 
          title={inventoryModel === 'branch_only' ? 'Branch Stock' : 'Warehouse Stock'} 
          value={stats.warehouseStock} 
          icon="🏭" 
          color="purple"
          trend={inventoryModel === 'branch_only' ? 'Across all branches' : 'Available for allocation'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-3 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paystack payouts</p>
            <p className="text-sm font-semibold capitalize truncate">
              {payoutSettings?.paystack_subaccount_status ?? 'not connected'}
            </p>
            <button type="button" className="text-[10px] text-primary mt-0.5" onClick={() => setActiveTab('settings-profile')}>
              Manage in settings →
            </button>
          </div>
        </div>
        <div className="glass-card p-3 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <CreditCard className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Platform fee</p>
            <p className="text-sm font-semibold tabular-nums">
              {payoutSettings?.platform_fee_percent ?? payoutSettings?.default_platform_fee_percent ?? 5}% per order
            </p>
          </div>
        </div>
        <div className="glass-card p-3 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <CalendarClock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Plan · {subscription?.plan ? formatPlanLabel(subscription.plan) : '—'}</p>
            <p className="text-sm font-semibold">
              Renews{' '}
              {subscription?.plan_renewal_at
                ? new Date(subscription.plan_renewal_at).toLocaleDateString()
                : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <RealTimeIndicator companyId={companyId} />
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Live Online Orders */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground">Live Online Orders</h3>
                <p className="text-xs text-muted-foreground">New marketplace orders update instantly</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab('online-orders')}
              >
                View All ({pendingOnlineOrders.length})
              </Button>
            </div>
          </div>

          <div className={`${hasMoreOnlineOrders ? 'max-h-[320px] overflow-y-auto' : ''}`}>
            {displayOnlineOrders.length > 0 ? (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-secondary/60 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      When
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayOnlineOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-secondary/60 cursor-pointer transition-colors"
                      onClick={() => setActiveTab('online-orders')}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start space-x-2">
                          <div className="bg-emerald-500/15 p-1.5 rounded-lg">
                            <ShoppingBag className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-sm">
                              {order.shipping_name || 'Customer'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {order.shipping_phone || order.fulfillment_type || 'Order'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-foreground text-sm tabular-nums">
                          ₵{Number(order.total ?? 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(order.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </span>
                          <ArrowRight className="h-4 w-4 ml-2 text-muted-foreground" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-muted-foreground">No pending online orders</p>
                <p className="text-sm text-muted-foreground">New shop orders appear here live</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Restock Requests Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground">Recent Restock Requests</h3>
                <p className="text-xs text-muted-foreground">Click any request to process it</p>
              </div>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setActiveTab('requests')}
              >
                View All ({pendingRequests.length})
              </Button>
            </div>
          </div>
          
          <div className={`${hasMoreThan3 ? 'max-h-[320px] overflow-y-auto' : ''}`}>
            {displayRequests.length > 0 ? (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-secondary/60 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Branch & Staff
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Qty & Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayRequests.map(request => (
                    <tr 
                      key={request.id} 
                      className="hover:bg-secondary/60 cursor-pointer transition-colors"
                      onClick={() => {
                        setProcessingRequest(request);
                        setIsProcessRestockModalOpen(true);
                      }}
                    >
                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="flex items-start space-x-2">
                          <div className="bg-amber-500/15 p-1.5 rounded-lg">
                            <Package className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-sm">
                              {request.product_name || 'Product'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {request.product_sku || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Branch & Staff */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center text-xs">
                            <Building className="h-3 w-3 text-muted-foreground mr-1" />
                            <span className="font-medium text-foreground">{request.branch_name || 'Branch'}</span>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <User className="h-3 w-3 text-muted-foreground mr-1" />
                            {request.staff_name || 'Staff'}
                          </div>
                        </div>
                      </td>
                      
                      {/* Quantity & Date */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <span className="font-bold text-foreground text-sm">
                              {request.requested_quantity || 0}
                            </span>
                            <span className="ml-1 text-xs text-muted-foreground">units</span>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDate(request.created_at)}
                          </div>
                        </div>
                      </td>
                      
                      {/* Action */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </span>
                          <ArrowRight className="h-4 w-4 ml-2 text-muted-foreground" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <div className="text-3xl mb-3">🎉</div>
                <p className="text-muted-foreground">No pending requests</p>
                <p className="text-sm text-muted-foreground">All requests are processed</p>
              </div>
            )}
          </div>
          
          {/* Table Footer */}
          {displayRequests.length > 0 && (
            <div className="bg-secondary/60 px-6 py-3 border-t border-border">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Showing <span className="font-medium">{displayRequests.length}</span> of <span className="font-medium">{pendingRequests.length}</span> pending
                </div>
                {hasMoreThan3 && (
                  <div className="text-xs text-muted-foreground">
                    Scroll to see more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {isBranchOnly ? (
              <button
                type="button"
                data-tour="admin-branch-stock"
                onClick={() => setIsAddBranchStockModalOpen?.(true)}
                className="bg-primary/10 hover:bg-primary/15 p-3 rounded-lg text-center transition-colors group col-span-2"
              >
                <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">📦</span>
                <span className="text-xs font-medium text-foreground">Add stock to branch</span>
                <div className="text-[11px] text-muted-foreground mt-0.5">Stock shelves for POS & marketplace</div>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-tour="admin-warehouse-add"
                  onClick={() => setIsAddWarehouseProductModalOpen(true)}
                  className="bg-primary/10 hover:bg-primary/15 p-3 rounded-lg text-center transition-colors group"
                >
                  <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">➕</span>
                  <span className="text-xs font-medium text-foreground">Add to Warehouse</span>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Add new products</div>
                </button>
                <button
                  type="button"
                  data-tour="admin-allocate"
                  onClick={() => setIsBatchAllocationModalOpen(true)}
                  className="bg-sky-500/10 hover:bg-sky-500/15 p-3 rounded-lg text-center transition-colors group"
                >
                  <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">🚚</span>
                  <span className="text-xs font-medium text-foreground">Batch Allocate</span>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Multiple products</div>
                </button>
              </>
            )}
            <button
              type="button"
              data-tour="admin-staff-add"
              onClick={() => setIsStaffModalOpen(true)}
              className="bg-emerald-500/10 hover:bg-emerald-500/15 p-3 rounded-lg text-center transition-colors group"
            >
              <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">👤</span>
              <span className="text-xs font-medium text-foreground">Add Staff</span>
              <div className="text-[11px] text-muted-foreground mt-0.5">Sales team members</div>
            </button>
            {!isBranchOnly && (
              <button 
                onClick={() => setActiveTab('warehouse')}
                className="bg-purple-500/100/10 hover:bg-purple-500/100/15 p-3 rounded-lg text-center transition-colors group"
              >
                <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">🏭</span>
                <span className="text-xs font-medium text-foreground">Warehouse</span>
                <div className="text-[11px] text-muted-foreground mt-0.5">Full inventory view</div>
              </button>
            )}
            {isBranchOnly && (
              <button
                onClick={() => setActiveTab('inventory')}
                className="bg-green-500/10 hover:bg-green-500/15 p-3 rounded-lg text-center transition-colors group"
              >
                <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">🏪</span>
                <span className="text-xs font-medium text-foreground">Branch inventory</span>
                <div className="text-[11px] text-muted-foreground mt-0.5">View stock by branch</div>
              </button>
            )}
            <button 
              onClick={() => setActiveTab('online-orders')}
              className="bg-emerald-500/10 hover:bg-emerald-500/15 p-3 rounded-lg text-center transition-colors group sm:col-span-2"
            >
              <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
              <span className="text-xs font-medium text-foreground">Online shop orders</span>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {onlinePending > 0
                  ? `${onlinePending} pending — respond now`
                  : 'Confirm marketplace customer orders'}
              </div>
            </button>
          </div>
      </div>
    </div>
  );
};