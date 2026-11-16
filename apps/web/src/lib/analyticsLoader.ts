import { supabase } from './supabase';

export interface BranchStockTracking {
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  allocated_quantity: number;
  sold_quantity: number;
  remaining_quantity: number;
  total_revenue: number;
  unit_price: number;
  allocation_date: string;
}

export interface BranchPerformance {
  branch_id: string;
  branch_name: string;
  total_allocated: number;
  total_sold: number;
  total_remaining: number;
  total_revenue: number;
  products_count: number;
  sell_through_rate: number;
}

export interface AnalyticsData {
  totalSales: number;
  salesCount: number;
  averageOrderValue: number;
  todaySales: number;
  weekSales: number;
  monthSales: number;
  salesGrowth: number;
  topProducts: Array<{ product_name: string; total_sold: number; revenue: number }>;
  salesByBranch: Array<{ branch_id: string; branch_name: string; total_sales: number; count: number }>;
  salesTrend: Array<{ date: string; amount: number; count: number }>;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValue: number;
  warehouseValue: number;
  branchesValue: number;
  inventoryTurnover: number;
  warehouseStock: number;
  warehouseItems: number;
  pendingAllocations: number;
  recentRestocks: number;
  topSalespeople: Array<{ user_id: string; name: string; total_sales: number; order_count: number }>;
  pendingRequests: number;
  approvedRequests: number;
  fulfilledRequests: number;
  avgFulfillmentTime: number;
  branchStockTracking: BranchStockTracking[];
  branchPerformance: BranchPerformance[];
  onlineOrdersCount: number;
  onlineOrdersRevenue: number;
  pendingOnlineOrders: number;
  paystackPaymentsCount: number;
  platformFeesPaid: number;
  vendorPayoutTotal: number;
}

export const EMPTY_ANALYTICS: AnalyticsData = {
  totalSales: 0,
  salesCount: 0,
  averageOrderValue: 0,
  todaySales: 0,
  weekSales: 0,
  monthSales: 0,
  salesGrowth: 0,
  topProducts: [],
  salesByBranch: [],
  salesTrend: [],
  totalProducts: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  totalInventoryValue: 0,
  warehouseValue: 0,
  branchesValue: 0,
  inventoryTurnover: 0,
  warehouseStock: 0,
  warehouseItems: 0,
  pendingAllocations: 0,
  recentRestocks: 0,
  topSalespeople: [],
  pendingRequests: 0,
  approvedRequests: 0,
  fulfilledRequests: 0,
  avgFulfillmentTime: 0,
  branchStockTracking: [],
  branchPerformance: [],
  onlineOrdersCount: 0,
  onlineOrdersRevenue: 0,
  pendingOnlineOrders: 0,
  paystackPaymentsCount: 0,
  platformFeesPaid: 0,
  vendorPayoutTotal: 0,
};

async function fetchBranchStockTracking(
  companyId: string,
  selectedBranchId?: string,
): Promise<{ tracking: BranchStockTracking[]; performance: BranchPerformance[] }> {
  if (!companyId) {
    return { tracking: [], performance: [] };
  }

  try {
    const rangeStart = new Date('2020-01-01');
    const rangeEnd = new Date();

    console.log('🔍 Fetching branch stock tracking...');

    let allocationsQuery = supabase
      .from('allocations')
      .select(
        `
          id,
          to_branch_id,
          created_at,
          completed_at,
          status,
          allocation_items (
            id,
            allocation_id,
            product_id,
            retail_quantity,
            wholesale_quantity
          )
        `,
      )
      .eq('company_id', companyId)
      .gte('created_at', rangeStart.toISOString())
      .lte('created_at', rangeEnd.toISOString())
      .in('status', ['completed', 'approved', 'pending']);

    if (selectedBranchId && selectedBranchId !== 'all') {
      allocationsQuery = allocationsQuery.eq('to_branch_id', selectedBranchId);
    }

    const { data: allocations, error: allocationsError } = await allocationsQuery;
    if (allocationsError) {
      console.error('Allocations error:', allocationsError);
      throw allocationsError;
    }

    console.log(
      `✅ Allocations fetched: ${allocations?.length || 0} (${allocations?.filter((a) => a.status === 'completed').length || 0} completed, ${allocations?.filter((a) => a.status === 'pending').length || 0} pending)`,
    );

    const branchIds = [...new Set(allocations?.map((a) => a.to_branch_id) || [])];
    const { data: branches } = await supabase.from('branches').select('id, name').in('id', branchIds);
    const branchNameMap = new Map(branches?.map((b) => [b.id, b.name]) || []);

    const productIds = [
      ...new Set(
        allocations?.flatMap((a) => a.allocation_items?.map((item) => item.product_id) || []) || [],
      ),
    ];
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, price, wholesale_price')
      .in('id', productIds);
    const productMap = new Map(products?.map((p) => [p.id, p]) || []);

    let salesQuery = supabase
      .from('sales')
      .select('id, branch_id, created_at, sale_items(id, product_id, quantity, price)')
      .eq('company_id', companyId)
      .gte('created_at', rangeStart.toISOString())
      .lte('created_at', rangeEnd.toISOString());

    if (selectedBranchId && selectedBranchId !== 'all') {
      salesQuery = salesQuery.eq('branch_id', selectedBranchId);
    }

    const { data: sales } = await salesQuery;
    console.log('✅ Sales fetched:', sales?.length || 0);

    let inventoryQuery = supabase
      .from('branch_inventory')
      .select('branch_id, product_id, retail_quantity, wholesale_quantity')
      .eq('company_id', companyId);

    if (selectedBranchId && selectedBranchId !== 'all') {
      inventoryQuery = inventoryQuery.eq('branch_id', selectedBranchId);
    }

    const { data: branchInventory } = await inventoryQuery;
    console.log('✅ Inventory fetched:', branchInventory?.length || 0);

    const trackingMap: Record<string, BranchStockTracking> = {};
    const performanceMap: Record<
      string,
      {
        branch_id: string;
        branch_name: string;
        total_allocated: number;
        total_sold: number;
        total_remaining: number;
        total_revenue: number;
        products: Set<string>;
      }
    > = {};

    allocations?.forEach((allocation) => {
      const branchId = allocation.to_branch_id;
      const branchName = branchNameMap.get(branchId) || 'Unknown Branch';

      if (!performanceMap[branchId]) {
        performanceMap[branchId] = {
          branch_id: branchId,
          branch_name: branchName,
          total_allocated: 0,
          total_sold: 0,
          total_remaining: 0,
          total_revenue: 0,
          products: new Set(),
        };
      }

      allocation.allocation_items?.forEach((item) => {
        const key = `${branchId}-${item.product_id}`;
        const allocatedQty = (item.retail_quantity || 0) + (item.wholesale_quantity || 0);
        const product = productMap.get(item.product_id);

        if (!trackingMap[key]) {
          trackingMap[key] = {
            branch_id: branchId,
            branch_name: branchName,
            product_id: item.product_id,
            product_name: product?.name || 'Unknown Product',
            product_sku: product?.sku || 'N/A',
            allocated_quantity: 0,
            sold_quantity: 0,
            remaining_quantity: 0,
            total_revenue: 0,
            unit_price: product?.price || 0,
            allocation_date: allocation.created_at,
          };
        }

        trackingMap[key].allocated_quantity += allocatedQty;
        performanceMap[branchId].total_allocated += allocatedQty;
        performanceMap[branchId].products.add(item.product_id);
      });
    });

    sales?.forEach((sale) => {
      const branchId = sale.branch_id;
      sale.sale_items?.forEach((item) => {
        const key = `${branchId}-${item.product_id}`;
        if (trackingMap[key]) {
          trackingMap[key].sold_quantity += item.quantity;
          trackingMap[key].total_revenue += Number(item.price) * item.quantity;
          if (performanceMap[branchId]) {
            performanceMap[branchId].total_sold += item.quantity;
            performanceMap[branchId].total_revenue += Number(item.price) * item.quantity;
          }
        }
      });
    });

    branchInventory?.forEach((inv) => {
      const key = `${inv.branch_id}-${inv.product_id}`;
      if (trackingMap[key]) {
        const remaining = (inv.retail_quantity || 0) + (inv.wholesale_quantity || 0);
        trackingMap[key].remaining_quantity = remaining;
        if (performanceMap[inv.branch_id]) {
          performanceMap[inv.branch_id].total_remaining += remaining;
        }
      }
    });

    const tracking = Object.values(trackingMap);
    const performance = Object.values(performanceMap).map((p) => ({
      branch_id: p.branch_id,
      branch_name: p.branch_name,
      total_allocated: p.total_allocated,
      total_sold: p.total_sold,
      total_remaining: p.total_remaining,
      total_revenue: p.total_revenue,
      products_count: p.products.size,
      sell_through_rate: p.total_allocated > 0 ? (p.total_sold / p.total_allocated) * 100 : 0,
    }));

    console.log('✅ Tracking data processed:', tracking.length, 'items');
    console.log('✅ Performance data:', performance.length, 'branches');

    return { tracking, performance };
  } catch (err) {
    console.error('❌ Branch stock tracking error:', err);
    return { tracking: [], performance: [] };
  }
}

export async function loadAnalyticsData(
  companyId: string,
  selectedBranchId?: string,
): Promise<AnalyticsData> {
  if (!companyId) {
    return EMPTY_ANALYTICS;
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
    const monthStart = new Date(now.setDate(now.getDate() - 30)).toISOString();

    let salesQuery = supabase
      .from('sales')
      .select('*, sale_items(*, products(name, price)), branches(id, name), users(id, full_name)')
      .eq('company_id', companyId);

    if (selectedBranchId && selectedBranchId !== 'all') {
      salesQuery = salesQuery.eq('branch_id', selectedBranchId);
    }

    const { data: sales, error: salesError } = await salesQuery;
    if (salesError) throw salesError;

    const totalSales = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
    const salesCount = sales?.length || 0;
    const averageOrderValue = salesCount > 0 ? totalSales / salesCount : 0;

    const todaySales =
      sales?.filter((sale) => sale.created_at >= todayStart).reduce((sum, sale) => sum + Number(sale.total), 0) ||
      0;

    const weekSales =
      sales?.filter((sale) => sale.created_at >= weekStart).reduce((sum, sale) => sum + Number(sale.total), 0) || 0;

    const monthSales =
      sales?.filter((sale) => sale.created_at >= monthStart).reduce((sum, sale) => sum + Number(sale.total), 0) ||
      0;

    const prevPeriodStart = new Date(new Date().setDate(new Date().getDate() - 60)).toISOString();
    const prevPeriodSales =
      sales
        ?.filter((sale) => sale.created_at >= prevPeriodStart && sale.created_at < monthStart)
        .reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
    const salesGrowth = prevPeriodSales > 0 ? ((monthSales - prevPeriodSales) / prevPeriodSales) * 100 : 0;

    const productSalesMap: Record<string, { name: string; sold: number; revenue: number }> = {};
    sales?.forEach((sale) => {
      sale.sale_items?.forEach((item) => {
        const name = item.products?.name || 'Unknown';
        if (!productSalesMap[name]) {
          productSalesMap[name] = { name, sold: 0, revenue: 0 };
        }
        productSalesMap[name].sold += item.quantity;
        productSalesMap[name].revenue += Number(item.price) * item.quantity;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({
        product_name: p.name,
        total_sold: p.sold,
        revenue: p.revenue,
      }));

    const branchSalesMap: Record<string, { id: string; name: string; total: number; count: number }> = {};
    sales?.forEach((sale) => {
      const branchId = sale.branch_id || 'unknown';
      const branchName = sale.branches?.name || 'Unknown';
      if (!branchSalesMap[branchId]) {
        branchSalesMap[branchId] = { id: branchId, name: branchName, total: 0, count: 0 };
      }
      branchSalesMap[branchId].total += Number(sale.total);
      branchSalesMap[branchId].count += 1;
    });

    const salesByBranch = Object.values(branchSalesMap).map((b) => ({
      branch_id: b.id,
      branch_name: b.name,
      total_sales: b.total,
      count: b.count,
    }));

    const salesTrend: Array<{ date: string; amount: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySales =
        sales?.filter((sale) => {
          const saleDate = new Date(sale.created_at);
          return saleDate >= dayStart && saleDate < dayEnd;
        }) || [];

      salesTrend.push({
        date: dayStart.toISOString().split('T')[0],
        amount: daySales.reduce((sum, sale) => sum + Number(sale.total), 0),
        count: daySales.length,
      });
    }

    const salespersonMap: Record<string, { id: string; name: string; total: number; count: number }> = {};
    sales?.forEach((sale) => {
      const userId = sale.salesperson_id || 'unknown';
      const userName = sale.users?.full_name || 'Unknown';
      if (!salespersonMap[userId]) {
        salespersonMap[userId] = { id: userId, name: userName, total: 0, count: 0 };
      }
      salespersonMap[userId].total += Number(sale.total);
      salespersonMap[userId].count += 1;
    });

    const topSalespeople = Object.values(salespersonMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((p) => ({
        user_id: p.id,
        name: p.name,
        total_sales: p.total,
        order_count: p.count,
      }));

    const { data: products } = await supabase
      .from('products')
      .select('*, central_inventory(*)')
      .eq('company_id', companyId);

    let warehouseQuery = supabase
      .from('warehouse_inventory')
      .select('*, products(*)')
      .eq('company_id', companyId);
    const { data: warehouseInventory } = await warehouseQuery;

    let branchInventoryQuery = supabase
      .from('branch_inventory')
      .select('*, products(*)')
      .eq('company_id', companyId);

    if (selectedBranchId && selectedBranchId !== 'all') {
      branchInventoryQuery = branchInventoryQuery.eq('branch_id', selectedBranchId);
    }

    const { data: branchInventory } = await branchInventoryQuery;

    const totalProducts = products?.length || 0;
    const lowStockCount =
      products?.filter((p) => {
        const qty = p.central_inventory?.[0]?.quantity || 0;
        return qty <= (p.low_stock_threshold ?? 0) && qty > 0;
      }).length || 0;
    const outOfStockCount =
      products?.filter((p) => (p.central_inventory?.[0]?.quantity || 0) === 0).length || 0;

    const warehouseValue =
      warehouseInventory?.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.products?.price || 0),
        0,
      ) || 0;

    const branchesValue =
      branchInventory?.reduce(
        (sum, item) =>
          sum +
          (Number(item.retail_quantity) + Number(item.wholesale_quantity)) *
            Number(item.products?.price || 0),
        0,
      ) || 0;

    const totalInventoryValue = warehouseValue + branchesValue;
    const warehouseStock = warehouseInventory?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
    const warehouseItems = warehouseInventory?.length || 0;
    const inventoryTurnover = totalInventoryValue > 0 ? (monthSales / totalInventoryValue) * 12 : 0;

    let pendingAllocationsQuery = supabase
      .from('allocations')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pending');

    if (selectedBranchId && selectedBranchId !== 'all') {
      pendingAllocationsQuery = pendingAllocationsQuery.eq('to_branch_id', selectedBranchId);
    }

    const { data: pendingAllocationsData } = await pendingAllocationsQuery;
    const pendingAllocations = pendingAllocationsData?.length || 0;

    let recentRestocksQuery = supabase
      .from('restock_requests')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', weekStart);

    if (selectedBranchId && selectedBranchId !== 'all') {
      recentRestocksQuery = recentRestocksQuery.eq('branch_id', selectedBranchId);
    }

    const { data: recentRestocksData } = await recentRestocksQuery;
    const recentRestocks = recentRestocksData?.length || 0;

    let restockRequestsQuery = supabase.from('restock_requests').select('*').eq('company_id', companyId);

    if (selectedBranchId && selectedBranchId !== 'all') {
      restockRequestsQuery = restockRequestsQuery.eq('branch_id', selectedBranchId);
    }

    const { data: restockRequests } = await restockRequestsQuery;
    const pendingRequests = restockRequests?.filter((r) => r.status === 'pending').length || 0;
    const approvedRequests = restockRequests?.filter((r) => r.status === 'approved').length || 0;
    const fulfilledRequests = restockRequests?.filter((r) => r.status === 'fulfilled').length || 0;

    const fulfilledWithTimes =
      restockRequests?.filter((r) => r.status === 'fulfilled' && r.created_at && r.fulfilled_at) || [];
    const avgFulfillmentTime =
      fulfilledWithTimes.length > 0
        ? fulfilledWithTimes.reduce((sum, r) => {
            const created = new Date(r.created_at).getTime();
            const fulfilled = new Date(r.fulfilled_at!).getTime();
            return sum + (fulfilled - created);
          }, 0) /
          fulfilledWithTimes.length /
          (1000 * 60 * 60)
        : 0;

    const { tracking: branchStockTracking, performance: branchPerformance } =
      await fetchBranchStockTracking(companyId, selectedBranchId);

    const [{ data: onlineOrders }, { data: paystackPayments }] = await Promise.all([
      supabase
        .from('online_orders')
        .select('total, status, payment_method')
        .eq('company_id', companyId),
      supabase
        .from('payment_transactions')
        .select('amount, platform_fee, vendor_amount, status')
        .eq('company_id', companyId)
        .eq('status', 'success'),
    ]);

    const onlineOrdersCount = onlineOrders?.length ?? 0;
    const onlineOrdersRevenue =
      onlineOrders?.reduce((sum, o) => sum + Number(o.total ?? 0), 0) ?? 0;
    const pendingOnlineOrders =
      onlineOrders?.filter((o) => ['pending', 'confirmed', 'processing'].includes(o.status)).length ?? 0;
    const paystackPaymentsCount = paystackPayments?.length ?? 0;
    const platformFeesPaid =
      paystackPayments?.reduce((sum, p) => sum + Number(p.platform_fee ?? 0), 0) ?? 0;
    const vendorPayoutTotal =
      paystackPayments?.reduce((sum, p) => sum + Number(p.vendor_amount ?? 0), 0) ?? 0;

    return {
      totalSales,
      salesCount,
      averageOrderValue,
      todaySales,
      weekSales,
      monthSales,
      salesGrowth,
      topProducts,
      salesByBranch,
      salesTrend,
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue,
      warehouseValue,
      branchesValue,
      inventoryTurnover,
      warehouseStock,
      warehouseItems,
      pendingAllocations,
      recentRestocks,
      topSalespeople,
      pendingRequests,
      approvedRequests,
      fulfilledRequests,
      avgFulfillmentTime,
      branchStockTracking,
      branchPerformance,
      onlineOrdersCount,
      onlineOrdersRevenue,
      pendingOnlineOrders,
      paystackPaymentsCount,
      platformFeesPaid,
      vendorPayoutTotal,
    };
  } catch (err) {
    console.error('Analytics fetch error:', err);
    throw err;
  }
}
