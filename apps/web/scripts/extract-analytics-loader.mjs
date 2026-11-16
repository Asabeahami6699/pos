import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.join('src/hooks/useAnalytics.ts'), 'utf8');

const typesStart = src.indexOf('export interface BranchStockTracking');
const typesEnd = src.indexOf('export const useAnalytics');
const types = src.slice(typesStart, typesEnd);

const empty = `
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
};
`;

let branchFn = src.slice(
  src.indexOf('const fetchBranchStockTracking = useCallback(async'),
  src.indexOf('// ========== MAIN ANALYTICS FETCH ==========')
);
branchFn = branchFn
  .replace('const fetchBranchStockTracking = useCallback(async', 'async function fetchBranchStockTracking(')
  .replace(') => {', 'companyId: string, selectedBranchId?: string) {')
  .replace(/\}, \[companyId, selectedBranchId\]\);\s*/, '');

let mainFn = src.slice(
  src.indexOf('const fetchAnalytics = useCallback(async () => {'),
  src.indexOf('// Debounced refetch')
);
mainFn = mainFn
  .replace('const fetchAnalytics = useCallback(async () => {', 'export async function loadAnalyticsData(companyId: string, selectedBranchId?: string) {')
  .replace('setLoading(false);\n      return;', 'return EMPTY_ANALYTICS;')
  .replace('setLoading(true);\n      setError(null);\n\n', '')
  .replace('setAnalytics({', 'return {')
  .replace(/}\);\s*\n\n    } catch \(err: any\) {\s*\n      console.error\('Analytics fetch error:', err\);\s*\n      setError\(err.message\);/s, '};\n\n    } catch (err) {\n      console.error(\'Analytics fetch error:\', err);\n      throw err;')
  .replace(/\} finally {\s*\n      setLoading\(false\);\s*\n    }\s*\n  }, \[companyId, selectedBranchId, fetchBranchStockTracking\]\);/s, '}');

const out = `import { supabase } from './supabase';\n\n${types}\n${empty}\n${branchFn}\n${mainFn}\n`;

fs.writeFileSync(path.join('src/lib/analyticsLoader.ts'), out);
console.log('Created analyticsLoader.ts');
