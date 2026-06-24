import {
    getCategorySales,
    getCurrentActiveShift,
    getDashboardStats,
    getLowStockItems,
    getPaymentMethodStats,
    getRecentMaterials,
    getRecentOrders,
    getRevenueTrend,
    getTopProducts,
} from "../repositories/dashboard.repository";
import type { DashboardRevenuePeriod } from "../types/dashboard.types";

function formatDateInput(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthInput(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboardSummaryService(
    period: DashboardRevenuePeriod = "week",
    startDate?: string,
    endDate?: string
) {
    let targetDate = new Date();
    if (startDate) {
        const parsed = new Date(startDate);
        if (!Number.isNaN(parsed.getTime())) {
            targetDate = parsed;
        }
    }

    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    const targetDay = targetDate.getDate();

    const [
        stats,
        revenueRows,
        topProducts,
        recentOrders,
        recentMaterials,
        lowStockItems,
        categorySales,
        paymentMethodRows,
        currentShiftRow,
    ] = await Promise.all([
        getDashboardStats(startDate, endDate),
        getRevenueTrend(period, targetYear, targetMonth, targetDay),
        getTopProducts(startDate, endDate),
        getRecentOrders(startDate, endDate),
        getRecentMaterials(),
        getLowStockItems(),
        getCategorySales(startDate, endDate),
        getPaymentMethodStats(startDate, endDate),
        getCurrentActiveShift(),
    ]);

    let totalPaymentRevenue = 0;
    const paymentMethods = paymentMethodRows.map((item) => {
        const revenue = Number(item.revenue ?? 0);
        totalPaymentRevenue += revenue;
        return {
            method: String(item.method),
            revenue,
            percentage: 0,
            ordersCount: Number(item.ordersCount ?? 0),
        };
    });

    if (totalPaymentRevenue > 0) {
        paymentMethods.forEach((item) => {
            item.percentage = Math.round((item.revenue / totalPaymentRevenue) * 100);
        });
    }

    const currentShift = currentShiftRow
        ? {
            id: String(currentShiftRow.id),
            userName: String(currentShiftRow.userName),
            expectedStartTime: currentShiftRow.expectedStartTime as Date,
            expectedEndTime: currentShiftRow.expectedEndTime as Date,
        }
        : null;

    let revenueTrend: Array<{ sort: number; label: string; revenue: number }> = [];
    if (period === "week") {
        const trendMap = new Map<string, number>();
        for (const row of revenueRows) {
            trendMap.set(String(row.label), Number(row.revenue ?? 0));
        }
        revenueTrend = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(targetDate);
            date.setDate(targetDate.getDate() - (6 - index));
            const dateKey = formatDateInput(date);

            return {
                sort: index + 1,
                label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
                revenue: trendMap.get(dateKey) ?? 0,
            };
        });
    } else {
        const trendMap = new Map<string, number>();
        for (const row of revenueRows) {
            trendMap.set(String(row.label), Number(row.revenue ?? 0));
        }
        const last12MonthsTrend = Array.from({ length: 12 }, (_, index) => {
            const date = new Date(targetYear, targetMonth - 12 + index, 1);
            const monthKey = formatMonthInput(date);

            return {
                sort: index + 1,
                label: `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`,
                revenue: trendMap.get(monthKey) ?? 0,
            };
        });

        revenueTrend = last12MonthsTrend;
    }

    return {
        stats: {
            todayRevenue: Number(stats.todayRevenue ?? 0),
            todayOrders: Number(stats.todayOrders ?? 0),
            activeCategories: Number(stats.activeCategories ?? 0),
            totalMaterials: Number(stats.totalMaterials ?? 0),
            totalCustomers: Number(stats.totalCustomers ?? 0),
            activeProducts: Number(stats.activeProducts ?? 0),
            totalStockValue: Number(stats.totalStockValue ?? 0),
        },
        revenueTrend,
        topProducts: topProducts.map((item) => ({
            name: String(item.name),
            imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
            soldQuantity: Number(item.soldQuantity ?? 0),
            revenue: Number(item.revenue ?? 0),
        })),
        recentOrders: recentOrders.map((item) => ({
            id: String(item.id),
            customerName: String(item.customerName),
            finalAmount: Number(item.finalAmount ?? 0),
            status: String(item.status),
            createdAt: item.createdAt as Date,
        })),
        materials: recentMaterials.map((item) => ({
            name: String(item.name),
            sku: String(item.sku),
            category: String(item.category || "Chưa phân loại"),
            importPrice: Number(item.importPrice ?? 0),
        })),
        lowStockItems: lowStockItems.map((item) => ({
            id: String(item.id),
            name: String(item.name),
            sku: String(item.sku || ""),
            type: String(item.type) === "product" ? "product" as const : "material" as const,
            stockQuantity: Number(item.stockQuantity ?? 0),
            threshold: Number(item.threshold ?? 0),
            unit: item.unit ? String(item.unit) : null,
        })),
        categorySales: categorySales.map((item) => ({
            name: String(item.name),
            imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
            quantity: Number(item.quantity ?? 0),
            revenue: Number(item.revenue ?? 0),
        })),
        paymentMethods,
        currentShift,
    };
}
