const API_BASE_URL = "http://localhost:5000/api";

export type DashboardRevenuePeriod = "month" | "year";

export type DashboardSummary = {
    stats: {
        todayRevenue: number;
        todayOrders: number;
        activeCategories: number;
        lowStockProducts: number;
        totalCustomers: number;
        activeProducts: number;
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
    stockAlerts: Array<{
        productName: string;
        stockQuantity: number;
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

type ApiResponse<T> = {
    success: boolean;
    message: string;
    data: T;
};

function getAuthHeaders() {
    const token = localStorage.getItem("auth_token");

    return {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
    };
}

export async function getDashboardSummary(period: DashboardRevenuePeriod = "month", startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ period });
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const response = await fetch(`${API_BASE_URL}/dashboard/summary?${params.toString()}`, {
        method: "GET",
        headers: getAuthHeaders(),
        cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Không tải được dữ liệu dashboard");
    }

    return data as ApiResponse<DashboardSummary>;
}