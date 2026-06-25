import { apiRequest } from "./api-client";

export type DashboardRevenuePeriod = "week" | "year";

export type DashboardSummary = {
  stats: {
    todayRevenue: number;
    todayOrders: number;
    activeCategories: number;
    totalMaterials: number;
    totalCustomers: number;
    activeProducts: number;
    totalStockValue: number;
  };
  revenueTrend: Array<{
    sort: number;
    label: string;
    revenue: number;
  }>;
  topProducts: Array<{
    name: string;
    imageUrl?: string;
    soldQuantity: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    customerName: string;
    finalAmount: number;
    status: string;
    createdAt: string;
  }>;
  materials: Array<{
    name: string;
    sku: string;
    category: string;
    importPrice: number;
  }>;
  lowStockItems: Array<{
    id: string;
    name: string;
    sku: string;
    type: "product" | "material";
    stockQuantity: number;
    threshold: number;
    unit: string | null;
  }>;
  categorySales: Array<{
    name: string;
    imageUrl?: string;
    quantity: number;
    revenue: number;
  }>;
  paymentMethods: Array<{
    method: string;
    revenue: number;
    percentage: number;
    ordersCount: number;
  }>;
  currentShift: {
    id: string;
    userName: string;
    expectedStartTime: string;
    expectedEndTime: string;
  } | null;
};

export function getDashboardSummary(
  period: DashboardRevenuePeriod = "week",
  startDate?: string,
  endDate?: string
) {
  const params = new URLSearchParams({ period });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  return apiRequest<DashboardSummary>({
    method: "GET",
    url: `/dashboard/summary?${params.toString()}`,
  });
}
