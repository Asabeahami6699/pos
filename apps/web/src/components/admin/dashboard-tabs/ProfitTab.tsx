import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Package,
  ShoppingBag,
  Store,
  RefreshCw,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { DashboardHeader } from '../DashboardHeader';
import { Button } from '../../Button';
import { useProfit } from '../../../hooks/useProfit';
import type { ProfitPeriod } from '../../../lib/profitLoader';

interface ProfitTabProps {
  companyId: string;
}

const formatCurrency = (amount: number) =>
  `₵${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (num: number) => `${num.toFixed(1)}%`;

const PERIODS: Array<{ id: ProfitPeriod; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: '30 days' },
  { id: 'all', label: 'All time' },
];

export const ProfitTab: React.FC<ProfitTabProps> = ({ companyId }) => {
  const [period, setPeriod] = useState<ProfitPeriod>('month');
  const { data, loading, error, refresh } = useProfit(companyId, period);

  return (
    <div className="space-y-5">
      <DashboardHeader
        title="Profit"
        subtitle="Revenue, cost of goods, and margin from POS sales and online orders based on product prices."
        secondaryAction={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    period === p.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <div className="glass-card p-3 text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          title="Revenue"
          value={formatCurrency(data.revenue)}
          icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          accent="bg-emerald-500/10"
          meta={`${data.salesCount} orders · ${data.unitsSold} units`}
        />
        <Kpi
          title="Cost of goods"
          value={formatCurrency(data.cost)}
          icon={<Wallet className="w-4 h-4 text-amber-600" />}
          accent="bg-amber-500/10"
          meta={
            data.estimatedCostShare > 0
              ? `${formatCurrency(data.estimatedCostShare)} estimated (no cost price)`
              : 'From product cost prices'
          }
        />
        <Kpi
          title="Net profit"
          value={formatCurrency(data.profit)}
          icon={<TrendingUp className="w-4 h-4 text-sky-600" />}
          accent="bg-sky-500/10"
          meta={data.profit >= 0 ? 'Revenue − cost' : 'Loss for this period'}
        />
        <Kpi
          title="Margin"
          value={formatPercent(data.margin_percent)}
          icon={<Percent className="w-4 h-4 text-violet-600" />}
          accent="bg-violet-500/10"
          meta={`${data.productsWithCost} products with cost · ${data.productsMissingCost} missing`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            POS sales
          </h3>
          <dl className="space-y-2 text-sm">
            <Row label="Revenue" value={formatCurrency(data.posRevenue)} />
            <Row label="Cost" value={formatCurrency(data.posCost)} />
            <Row
              label="Profit"
              value={formatCurrency(data.posProfit)}
              strong
              positive={data.posProfit >= 0}
            />
          </dl>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            Online orders
          </h3>
          <dl className="space-y-2 text-sm">
            <Row label="Revenue" value={formatCurrency(data.onlineRevenue)} />
            <Row label="Cost" value={formatCurrency(data.onlineCost)} />
            <Row
              label="Profit"
              value={formatCurrency(data.onlineProfit)}
              strong
              positive={data.onlineProfit >= 0}
            />
          </dl>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Profit by product
          </h3>
          <p className="text-[11px] text-muted-foreground max-w-md">
            Cost uses each product’s <span className="font-medium">cost price</span>. If missing,
            cost is estimated at 70% of the selling price.
          </p>
        </div>

        {loading && data.byProduct.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading profit…</p>
        ) : data.byProduct.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No sales in this period yet.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-medium">Product</th>
                  <th className="py-2 px-2 font-medium text-right">Units</th>
                  <th className="py-2 px-2 font-medium text-right">Revenue</th>
                  <th className="py-2 px-2 font-medium text-right">Cost</th>
                  <th className="py-2 px-2 font-medium text-right">Profit</th>
                  <th className="py-2 px-2 font-medium text-right">Margin</th>
                  <th className="py-2 px-2 font-medium text-right">Unit margin</th>
                </tr>
              </thead>
              <tbody>
                {data.byProduct.map((row) => (
                  <tr key={row.product_id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 px-2">
                      <div className="font-medium text-foreground truncate max-w-[220px]">
                        {row.product_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        {row.sku || '—'}
                        {row.cost_estimated && (
                          <span className="text-amber-600">· est. cost</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{row.units_sold}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(row.cost)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right tabular-nums font-semibold ${
                        row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(row.profit)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">
                      {formatPercent(row.margin_percent)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(row.catalog_unit_profit)}
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

function Kpi({
  title,
  value,
  icon,
  accent,
  meta,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  meta?: string;
}) {
  return (
    <div className="glass-card p-3 min-w-0">
      <div className={`inline-flex p-1.5 rounded-lg mb-2 ${accent}`}>{icon}</div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
        {title}
      </p>
      <p className="text-lg font-bold text-foreground truncate tabular-nums mt-0.5" title={value}>
        {value}
      </p>
      {meta && <p className="text-[10px] text-muted-foreground mt-1 truncate">{meta}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  positive,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`tabular-nums ${
          strong
            ? positive
              ? 'font-semibold text-emerald-600'
              : 'font-semibold text-red-600'
            : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
