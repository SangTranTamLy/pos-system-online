export type DashboardStats = {
    todayRevenue: number;
    todayOrders: number;
    activeCategories: number;
    totalMaterials: number;
    totalCustomers: number;
    activeProducts: number;
    totalStockValue: number;
};

export type DashboardRevenuePeriod = "week" | "year";

export type DashboardRevenuePoint = {
    sort: number;
    label: string;
    revenue: number;
};

export type DashboardTopProduct = {
    name: string;
    imageUrl?: string;
    soldQuantity: number;
    revenue: number;
};

export type DashboardRecentOrder = {
    id: string;
    customerName: string;
    finalAmount: number;
    status: string;
    createdAt: Date | string;
};

export type DashboardMaterial = {
    name: string;
    sku: string;
    category: string;
    importPrice: number;
};

export type DashboardLowStockItem = {
    id: string;
    name: string;
    sku: string;
    type: "product" | "material";
    stockQuantity: number;
    threshold: number;
    unit: string | null;
};

export type DashboardCategorySale = {
    name: string;
    imageUrl?: string;
    quantity: number;
    revenue: number;
};

export type PaymentMethodStat = {
    method: string;
    revenue: number;
    percentage: number;
    ordersCount: number;
};

export type CurrentShift = {
    id: string;
    userName: string;
    expectedStartTime: Date | string;
    expectedEndTime: Date | string;
} | null;

export type DashboardSummary = {
    stats: DashboardStats;
    revenueTrend: DashboardRevenuePoint[];
    topProducts: DashboardTopProduct[];
    recentOrders: DashboardRecentOrder[];
    materials: DashboardMaterial[];
    lowStockItems: DashboardLowStockItem[];
    categorySales: DashboardCategorySale[];
    paymentMethods: PaymentMethodStat[];
    currentShift: CurrentShift;
};
