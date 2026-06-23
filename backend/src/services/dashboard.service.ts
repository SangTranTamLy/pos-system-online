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

export async function getDashboardSummaryService(
    period: DashboardRevenuePeriod = "month",
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
        getRevenueTrend(period, targetYear, targetMonth),
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
    if (period === "month") {
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const trendMap = new Map<number, number>();
        for (let day = 1; day <= daysInMonth; day += 1) {
            trendMap.set(day, 0);
        }
        for (const row of revenueRows) {
            trendMap.set(Number(row.sort), Number(row.revenue ?? 0));
        }
        revenueTrend = Array.from(trendMap.entries()).map(([day, revenue]) => ({
            sort: day,
            label: `${String(day).padStart(2, "0")}/${String(targetMonth).padStart(2, "0")}`,
            revenue,
        }));
    } else {
        const trendMap = new Map<number, number>();
        for (let month = 1; month <= 12; month += 1) {
            trendMap.set(month, 0);
        }
        for (const row of revenueRows) {
            trendMap.set(Number(row.sort), Number(row.revenue ?? 0));
        }
        revenueTrend = Array.from(trendMap.entries()).map(([month, revenue]) => ({
            sort: month,
            label: `Tháng ${month}`,
            revenue,
        }));
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
            quantity: Number(item.quantity ?? 0),
            revenue: Number(item.revenue ?? 0),
        })),
        paymentMethods,
        currentShift,
    };
}
