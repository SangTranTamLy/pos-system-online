export interface EmployeeRevenueReport {
  id: string; // UUID của nhân viên
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

export interface TopProductReportData {
  name: string;
  soldQuantity: number;
  revenue: number;
}


export interface FinancialTrendPoint {
  date: string;
  label: string; // e.g., "20/06" hoặc "Tháng 06"
  revenue: number;
  cogs: number;
  profit: number;
}

// Báo cáo Giá trị Tồn kho
export interface InventoryValuationData {
  totalItems: number;
  totalValue: number;
}

export interface CategoryValuation {
  categoryName: string;
  totalValue: number;
  percentage: number;
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

// Báo cáo Hiệu suất Nhân viên
export interface EmployeePerformanceReport {
  id: string;
  fullName: string;
  shiftsCount: number;
  totalOrders: number;
  totalRevenue: number;
}

// Báo cáo So sánh Tăng trưởng
export interface ComparisonPoint {
  label: string; // e.g., "Ngày 1" hoặc "Thứ Hai"
  currentPeriodValue: number;
  previousPeriodValue: number;
}

export interface ComparisonReportData {
  currentTotal: number;
  previousTotal: number;
  growthPercentage: number;
  trend: ComparisonPoint[];
}

// Báo cáo Khách hàng thân thiết
export interface CustomerRetentionReport {
  id: string;
  fullName: string;
  phone: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  lastOrderAt: string | null;
}
