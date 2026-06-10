export type DashboardStats = {
    todayRevenue: number;
    todayOrders: number;
    activeCategories: number;
    lowStockProducts: number;
    totalCustomers: number;
    activeProducts: number;
};

export type DashboardRevenuePeriod = "month" | "year";

export type DashboardRevenuePoint = {
    sort: number;
    label: string;
    revenue: number;
};

export type DashboardTopProduct = {
    name: string;
    soldQuantity: number;
    revenue: number;
};

export type DashboardRecentOrder = {
    id: string;
    customerName: string;
    finalAmount: number;
    status: string;
    createdAt: Date;
};

export type DashboardStockAlert = {
    productName: string;
    stockQuantity: number;
};

export type DashboardSummary = {
    stats: DashboardStats;
    revenueTrend: DashboardRevenuePoint[];
    topProducts: DashboardTopProduct[];
    recentOrders: DashboardRecentOrder[];
    stockAlerts: DashboardStockAlert[];
};