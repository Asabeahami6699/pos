import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { HistoryFilters, Product, Sale } from '../../types/index';
import { DateRangePicker } from './DateRangePicker';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface PosReportsPanelProps {
  sales: Sale[];
  products: Product[];
  loading: boolean;
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  salespersonId?: string;
  branchName?: string;
  onRefresh: () => void;
  onOpenSale: (sale: Sale) => void;
  onViewSalesHistory: () => void;
}

type Scope = 'mine' | 'branch';

export const PosReportsPanel: React.FC<PosReportsPanelProps> = ({
  sales,
  products,
  loading,
  filters,
  onFiltersChange,
  salespersonId,
  branchName,
  onRefresh,
  onOpenSale,
  onViewSalesHistory,
}) => {
  const [scope, setScope] = useState<Scope>('mine');

  const scopedSales = useMemo(() => {
    if (scope === 'mine' && salespersonId) {
      return sales.filter((s) => s.salesperson_id === salespersonId);
    }
    return sales;
  }, [sales, scope, salespersonId]);

  const stats = useMemo(() => {
    const totalSales = scopedSales.length;
    const grossRevenue = scopedSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const refunds = scopedSales.reduce((sum, s) => sum + Number(s.refunded_amount || 0), 0);
    const netRevenue = grossRevenue - refunds;
    const avgTicket = totalSales > 0 ? grossRevenue / totalSales : 0;

    const retailCount = scopedSales.filter((s) => s.sales_type !== 'wholesale').length;
    const wholesaleCount = scopedSales.filter((s) => s.sales_type === 'wholesale').length;

    const paymentMap = new Map<string, { count: number; total: number }>();
    scopedSales.forEach((s) => {
      const method = (s.payment_method || 'unknown').toLowerCase();
      const prev = paymentMap.get(method) || { count: 0, total: 0 };
      paymentMap.set(method, {
        count: prev.count + 1,
        total: prev.total + Number(s.total || 0),
      });
    });

    const productMap = new Map<
      string,
      { name: string; sku: string; qty: number; revenue: number }
    >();
    scopedSales.forEach((sale) => {
      (sale.sale_items || []).forEach((item) => {
        const key = item.product_id;
        const name =
          (item as { products?: { name?: string; sku?: string } }).products?.name ||
          item.product?.name ||
          'Product';
        const sku =
          (item as { products?: { name?: string; sku?: string } }).products?.sku ||
          item.product?.sku ||
          '';
        const qty = Number(item.quantity || 0);
        const lineTotal =
          Number(item.total_price ?? item.price * qty) || Number(item.price || 0) * qty;
        const prev = productMap.get(key) || { name, sku, qty: 0, revenue: 0 };
        productMap.set(key, {
          name,
          sku,
          qty: prev.qty + qty,
          revenue: prev.revenue + lineTotal,
        });
      });
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const recentSales = [...scopedSales]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    const lowStock = products.filter((p) => p.is_low_stock || (p.stock || 0) <= (p.low_stock_threshold || 5));
    const outOfStock = products.filter((p) => !p.stock || p.stock <= 0);

    return {
      totalSales,
      grossRevenue,
      refunds,
      netRevenue,
      avgTicket,
      retailCount,
      wholesaleCount,
      payments: Array.from(paymentMap.entries())
        .map(([method, data]) => ({ method, ...data }))
        .sort((a, b) => b.total - a.total),
      topProducts,
      recentSales,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      catalogCount: products.length,
    };
  }, [scopedSales, products]);

  const money = (n: number) => `₵${n.toFixed(2)}`;

  return (
    <div className="space-y-5" data-tour="pos-reports">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Sales Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {branchName ? `${branchName} · ` : ''}
            {formatDateForDisplay(filters.dateRange.from)} –{' '}
            {formatDateForDisplay(filters.dateRange.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                scope === 'mine'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              My sales
            </button>
            <button
              type="button"
              onClick={() => setScope('branch')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                scope === 'branch'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Branch
            </button>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onViewSalesHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Sales list
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Date range</h3>
        <DateRangePicker
          range={filters.dateRange}
          onChange={(range) => onFiltersChange({ ...filters, dateRange: range })}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Sales</span>
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold text-foreground">{stats.totalSales}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.retailCount} retail · {stats.wholesaleCount} wholesale
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Gross</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600">{money(stats.grossRevenue)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Before refunds</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Refunds</span>
            <Wallet className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-extrabold text-red-500">{money(stats.refunds)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Net {money(stats.netRevenue)}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Avg ticket</span>
            <Banknote className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-extrabold text-orange-500">{money(stats.avgTicket)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Per completed sale</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Payment methods</h3>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : stats.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this range</p>
          ) : (
            <ul className="space-y-2">
              {stats.payments.map((p) => (
                <li
                  key={p.method}
                  className="flex items-center justify-between text-sm gap-2"
                >
                  <span className="capitalize text-muted-foreground truncate">
                    {p.method.replace(/_/g, ' ')}
                    <span className="text-[11px] ml-1">({p.count})</span>
                  </span>
                  <span className="font-semibold text-foreground shrink-0">
                    {money(p.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Branch stock</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Products in catalog</span>
              <span className="font-semibold">{stats.catalogCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Low stock</span>
              <span className="font-semibold text-amber-600">{stats.lowStockCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Out of stock</span>
              <span className="font-semibold text-red-600">{stats.outOfStockCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="font-semibold text-sm mb-3">Top products</h3>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No product sales yet</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.topProducts.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {i + 1}. {p.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.qty} sold{p.sku ? ` · ${p.sku}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-orange-500 shrink-0">
                    {money(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recent sales</h3>
          <span className="text-xs text-muted-foreground">
            {scope === 'mine' ? 'Your sales' : 'Branch sales'}
          </span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading sales…</div>
        ) : stats.recentSales.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No sales found for this period. Try expanding the date range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Sale</th>
                  <th className="px-4 py-2.5 text-left font-medium">When</th>
                  <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-4 py-2.5 text-left font-medium">Pay</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-secondary/40 cursor-pointer"
                    onClick={() => onOpenSale(sale)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      #{sale.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(sale.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 truncate max-w-[140px]">
                      {sale.customer_name || 'Walk-in'}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {(sale.payment_method || '—').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">
                      {money(Number(sale.total || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
