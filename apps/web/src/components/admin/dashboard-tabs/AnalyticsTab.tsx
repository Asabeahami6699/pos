import React, { useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Warehouse,
  ShoppingCart,
  AlertTriangle,
  Clock,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Store,
  Zap,
  Activity,
  Users,
  Box,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { useAnalyticsStore } from '../../../stores/analyticsStore';
import { DashboardHeader } from '../DashboardHeader';
import { Button } from '../../Button';

interface AnalyticsTabProps {
  companyId: string;
}

const formatCurrency = (amount: number) =>
  `₵${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatNumber = (num: number) => num.toLocaleString('en-US');

const formatPercent = (num: number) => `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
};

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  pulse?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, accent, meta, badge, pulse }) => (
  <div className={`glass-card p-3 min-w-0 ${pulse ? 'animate-pulse' : ''}`}>
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className={`p-1.5 rounded-lg ${accent}`}>{icon}</div>
      {badge}
    </div>
    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
    <p className="text-lg font-bold text-foreground truncate tabular-nums mt-0.5" title={value}>
      {value}
    </p>
    {meta && <div className="text-[10px] text-muted-foreground mt-1">{meta}</div>}
  </div>
);

interface PanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ title, icon, children }) => (
  <div className="glass-card p-4">
    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ companyId }) => {
  const {
    selectedBranch,
    isRefreshing,
    lastUpdate,
    pulseAnimation,
    branches,
    setSelectedBranch,
    loadBranches,
    beginRefresh,
    endRefresh,
  } = useAnalyticsStore();

  const loadedKey = useAnalyticsStore((s) => s.loadedKey);
  const cacheKey = `${companyId}:${selectedBranch}`;

  const { analytics, loading, error, refetch } = useAnalytics(companyId, selectedBranch);

  const safe = useMemo(
    () => ({
      totalSales: analytics?.totalSales ?? 0,
      salesCount: analytics?.salesCount ?? 0,
      averageOrderValue: analytics?.averageOrderValue ?? 0,
      todaySales: analytics?.todaySales ?? 0,
      weekSales: analytics?.weekSales ?? 0,
      monthSales: analytics?.monthSales ?? 0,
      salesGrowth: analytics?.salesGrowth ?? 0,
      topProducts: analytics?.topProducts ?? [],
      salesByBranch: analytics?.salesByBranch ?? [],
      salesTrend: analytics?.salesTrend ?? [],
      totalProducts: analytics?.totalProducts ?? 0,
      lowStockCount: analytics?.lowStockCount ?? 0,
      outOfStockCount: analytics?.outOfStockCount ?? 0,
      totalInventoryValue: analytics?.totalInventoryValue ?? 0,
      warehouseValue: analytics?.warehouseValue ?? 0,
      branchesValue: analytics?.branchesValue ?? 0,
      inventoryTurnover: analytics?.inventoryTurnover ?? 0,
      warehouseStock: analytics?.warehouseStock ?? 0,
      warehouseItems: analytics?.warehouseItems ?? 0,
      topSalespeople: analytics?.topSalespeople ?? [],
      pendingRequests: analytics?.pendingRequests ?? 0,
      fulfilledRequests: analytics?.fulfilledRequests ?? 0,
      avgFulfillmentTime: analytics?.avgFulfillmentTime ?? 0,
      branchStockTracking: analytics?.branchStockTracking ?? [],
      branchPerformance: analytics?.branchPerformance ?? [],
      onlineOrdersCount: analytics?.onlineOrdersCount ?? 0,
      onlineOrdersRevenue: analytics?.onlineOrdersRevenue ?? 0,
      pendingOnlineOrders: analytics?.pendingOnlineOrders ?? 0,
      paystackPaymentsCount: analytics?.paystackPaymentsCount ?? 0,
      platformFeesPaid: analytics?.platformFeesPaid ?? 0,
      vendorPayoutTotal: analytics?.vendorPayoutTotal ?? 0,
    }),
    [analytics],
  );

  useEffect(() => {
    if (!companyId) return;
    void loadBranches(companyId);
  }, [companyId, loadBranches]);

  const handleRefresh = async () => {
    beginRefresh();
    await refetch();
    endRefresh();
  };

  const selectedBranchName = branches.find((b) => b.id === selectedBranch)?.name;
  const maxTrend = Math.max(...safe.salesTrend.map((d) => d.amount), 1);
  const maxBranchSales = Math.max(...safe.salesByBranch.map((b) => b.total_sales), 1);

  if (loading && loadedKey !== cacheKey) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Loading analytics…</p>
          <p className="text-xs text-muted-foreground mt-1">Fetching live data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-4 text-center border-destructive/30">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground mb-1">Analytics error</p>
        <p className="text-xs text-muted-foreground mb-3">{error}</p>
        <Button variant="danger" size="sm" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  const growthBadge = (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
        safe.salesGrowth >= 0
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
          : 'bg-red-500/100/10 text-red-600 dark:text-red-400 border-red-500/20'
      }`}
    >
      {safe.salesGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {formatPercent(safe.salesGrowth)}
    </span>
  );

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Analytics"
        subtitle={
          <span className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <span className="text-muted-foreground">· Updated {formatTimeAgo(lastUpdate)}</span>
            {selectedBranch !== 'all' && (
              <span className="text-muted-foreground">· {selectedBranchName}</span>
            )}
          </span>
        }
        actionButton={{
          label: isRefreshing ? 'Refreshing…' : 'Refresh',
          onClick: handleRefresh,
          icon: <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />,
        }}
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="input-modern pl-8 py-2 text-xs w-full"
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total Sales"
          value={formatCurrency(safe.totalSales)}
          icon={<DollarSign className="w-4 h-4 text-blue-500" />}
          accent="bg-blue-500/100/10"
          badge={growthBadge}
          pulse={pulseAnimation}
          meta={
            <span>
              {formatNumber(safe.salesCount)} orders · Avg {formatCurrency(safe.averageOrderValue)}
            </span>
          }
        />
        <KpiCard
          title="Inventory Value"
          value={formatCurrency(safe.totalInventoryValue)}
          icon={<Package className="w-4 h-4 text-purple-500" />}
          accent="bg-purple-500/100/10"
          badge={
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
              {safe.inventoryTurnover.toFixed(1)}x
            </span>
          }
          meta={<span>{formatNumber(safe.totalProducts)} products</span>}
        />
        <KpiCard
          title="Warehouse Stock"
          value={formatNumber(safe.warehouseStock)}
          icon={<Warehouse className="w-4 h-4 text-orange-500" />}
          accent="bg-orange-500/100/10"
          badge={
            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5">
              <Box className="w-3 h-3" />
              {formatNumber(safe.warehouseItems)}
            </span>
          }
          meta={<span>{formatCurrency(safe.warehouseValue)} value</span>}
        />
        <KpiCard
          title="Stock Alerts"
          value={formatNumber(safe.lowStockCount)}
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          accent="bg-red-500/100/10"
          badge={
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {safe.pendingRequests}
            </span>
          }
          meta={<span>{safe.outOfStockCount} out of stock</span>}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Today', value: formatCurrency(safe.todaySales), icon: Zap, color: 'text-cyan-500' },
          { label: 'This Week', value: formatCurrency(safe.weekSales), icon: Activity, color: 'text-blue-500' },
          { label: 'This Month', value: formatCurrency(safe.monthSales), icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Fulfilled', value: formatNumber(safe.fulfilledRequests), icon: CheckCircle, color: 'text-emerald-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-2.5 flex items-center gap-2 min-w-0">
            <Icon className={`w-4 h-4 shrink-0 ${color}`} />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
              <p className="text-sm font-bold text-foreground truncate tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <Panel title="Online shop & Paystack" icon={<ShoppingBag className="w-4 h-4 text-emerald-500" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Online orders', value: formatNumber(safe.onlineOrdersCount) },
            { label: 'Online revenue', value: formatCurrency(safe.onlineOrdersRevenue) },
            { label: 'Pending fulfillment', value: formatNumber(safe.pendingOnlineOrders) },
            { label: 'Paystack payments', value: formatNumber(safe.paystackPaymentsCount) },
            { label: 'Your payouts', value: formatCurrency(safe.vendorPayoutTotal) },
            { label: 'Platform fees paid', value: formatCurrency(safe.platformFeesPaid) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-secondary/30 p-3 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
              <p className="text-sm font-bold tabular-nums mt-1 truncate" title={value}>{value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
          <Wallet className="w-3 h-3" />
          Connect Paystack in Settings to accept online payments and automatic split settlements.
        </p>
      </Panel>

      {/* Branch performance */}
      {safe.branchPerformance.length > 0 && (
        <Panel title="Branch Performance" icon={<Store className="w-4 h-4 text-primary" />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {safe.branchPerformance.map((perf) => (
              <div key={perf.branch_id} className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs font-semibold text-foreground mb-2 truncate">{perf.branch_name}</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allocated</span>
                    <span className="font-medium tabular-nums">{formatNumber(perf.total_allocated)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sold</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatNumber(perf.total_sold)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-medium tabular-nums">{formatCurrency(perf.total_revenue)}</span>
                  </div>
                  <div className="pt-1.5">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Sell-through</span>
                      <span className="font-semibold">{perf.sell_through_rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, perf.sell_through_rate)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Stock tracking table */}
      <Panel title="Branch Stock Tracking" icon={<BarChart3 className="w-4 h-4 text-primary" />}>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Branch</th>
                <th className="text-right">Alloc</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Left</th>
                <th className="text-right">Revenue</th>
                <th className="text-center">Rate</th>
              </tr>
            </thead>
            <tbody>
              {safe.branchStockTracking.length > 0 ? (
                safe.branchStockTracking.map((item, index) => {
                  const rate =
                    item.allocated_quantity > 0
                      ? (item.sold_quantity / item.allocated_quantity) * 100
                      : 0;
                  return (
                    <tr key={`${item.branch_id}-${item.product_id}-${index}`}>
                      <td>
                        <p className="font-medium text-xs truncate max-w-[120px]">{item.product_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</p>
                      </td>
                      <td className="text-xs">{item.branch_name}</td>
                      <td className="text-right tabular-nums">{formatNumber(item.allocated_quantity)}</td>
                      <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatNumber(item.sold_quantity)}
                      </td>
                      <td className="text-right tabular-nums">{formatNumber(item.remaining_quantity)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(item.total_revenue)}</td>
                      <td className="text-center">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary">
                          {rate.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    No stock tracking data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="7-Day Sales Trend" icon={<TrendingUp className="w-4 h-4 text-primary" />}>
          <div className="space-y-2">
            {safe.salesTrend.map((day, index) => {
              const pct = (day.amount / maxTrend) * 100;
              return (
                <div key={index}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-muted-foreground">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(day.amount)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Top Products" icon={<ShoppingCart className="w-4 h-4 text-emerald-500" />}>
          <div className="space-y-2">
            {safe.topProducts.length > 0 ? (
              safe.topProducts.map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 shrink-0 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{product.product_name}</p>
                      <p className="text-[10px] text-muted-foreground">{product.total_sold} sold</p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold tabular-nums shrink-0">{formatCurrency(product.revenue)}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No product data</p>
            )}
          </div>
        </Panel>

        <Panel title="Sales by Branch" icon={<Store className="w-4 h-4 text-blue-500" />}>
          <div className="space-y-2">
            {safe.salesByBranch.length > 0 ? (
              safe.salesByBranch.map((branch, index) => {
                const pct = (branch.total_sales / maxBranchSales) * 100;
                return (
                  <div key={index}>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-foreground truncate">{branch.branch_name}</span>
                      <span className="font-semibold tabular-nums shrink-0 ml-2">
                        {formatCurrency(branch.total_sales)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="h-full bg-blue-500/100 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No branch data</p>
            )}
          </div>
        </Panel>

        <Panel title="Top Performers" icon={<Users className="w-4 h-4 text-purple-500" />}>
          <div className="space-y-2">
            {safe.topSalespeople.length > 0 ? (
              safe.topSalespeople.map((person, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-purple-500/100/20 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center justify-center">
                      {person.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{person.name}</p>
                      <p className="text-[10px] text-muted-foreground">{person.order_count} orders</p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold tabular-nums shrink-0">{formatCurrency(person.total_sales)}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No salesperson data</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Low stock', value: formatNumber(safe.lowStockCount), icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Pending requests', value: formatNumber(safe.pendingRequests), icon: Clock, color: 'text-amber-500' },
          { label: 'Fulfilled', value: formatNumber(safe.fulfilledRequests), icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Avg fulfillment', value: `${safe.avgFulfillmentTime.toFixed(1)}h`, icon: Clock, color: 'text-blue-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
            </div>
            <p className="text-base font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <Panel title="Inventory Overview" icon={<Package className="w-4 h-4 text-primary" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Warehouse value', value: formatCurrency(safe.warehouseValue) },
            { label: 'Branches value', value: formatCurrency(safe.branchesValue) },
            { label: 'Out of stock', value: formatNumber(safe.outOfStockCount), danger: true },
          ].map(({ label, value, danger }) => (
            <div key={label} className="rounded-lg border border-border bg-secondary/40 p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">{label}</p>
              <p className={`text-base font-bold tabular-nums ${danger ? 'text-destructive' : 'text-foreground'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
