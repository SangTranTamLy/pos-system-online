export interface EmployeeRevenue {
  id: string;
  full_name: string;
  role_id: string;
  total_orders: number;
  total_revenue: number;
}

export interface FinancialReportData {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossProfitMargin: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface FinancialTrendPoint {
  label: string;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface TopProductReportData {
  name: string;
  soldQuantity: number;
  revenue: number;
}

export interface FinancialReport {
  summary: FinancialReportData;
  trend: FinancialTrendPoint[];
  topProducts: TopProductReportData[];
  revenueGrowthPercent: number | null;
  ordersGrowthPercent: number | null;
  averageOrderValueGrowthPercent: number | null;
  cancelledOrdersGrowthPercent: number | null;
  materialPurchaseCost: number;
  materialPurchaseCostGrowthPercent: number | null;
}

export interface ProductValuation {
  name: string;
  sku: string;
  category: string;
  unit: string;
  stockQuantity: number;
  importPrice: number;
  totalValue: number;
}

export interface CategoryValuation {
  categoryName: string;
  totalValue: number;
  percentage: number;
}

export interface InventoryValuationReport {
  summary: {
    totalItems: number;
    totalValue: number;
    totalProductsValue: number;
    totalRawValue: number;
  };
  categories: CategoryValuation[];
  products: ProductValuation[];
  rawMaterials: ProductValuation[];
}

export interface EmployeePerformance {
  id: string;
  fullName: string;
  shiftsCount: number;
  totalOrders: number;
  totalRevenue: number;
}

export interface ComparisonPoint {
  label: string;
  currentPeriodValue: number;
  previousPeriodValue: number;
}

export interface ComparisonReport {
  currentTotal: number;
  previousTotal: number;
  growthPercentage: number;
  trend: ComparisonPoint[];
}

export interface CustomerRetentionReport {
  id: string;
  fullName: string;
  phone: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  lastOrderAt: string | null;
}
