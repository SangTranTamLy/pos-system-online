import {
    getDashboardStats,
    getRecentOrders,
    getRevenueTrend,
    getRecentMaterials,
    getTopProducts,
    getPaymentMethodStats,
    getCurrentActiveShift,
    type RevenueTrendRow,
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
        if (!isNaN(parsed.getTime())) {
            targetDate = parsed;
        }
    }
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;

    const [stats, revenueRows, topProducts, recentOrders, recentMaterials, paymentMethodRows, currentShiftRow] =
        await Promise.all([
        getDashboardStats(startDate, endDate),
        getRevenueTrend(period, targetYear, targetMonth),
        getTopProducts(startDate, endDate),
        getRecentOrders(startDate, endDate),
        getRecentMaterials(),
        getPaymentMethodStats(startDate, endDate),
        getCurrentActiveShift(),
        ]);

    let totalPaymentRevenue = 0;
    const paymentMethods = paymentMethodRows.map((item) => {
        const rev = Number(item.revenue ?? 0);
        totalPaymentRevenue += rev;
        return {
            method: String(item.method),
            revenue: rev,
            percentage: 0,
            ordersCount: Number(item.ordersCount ?? 0)
        };
    });

    if (totalPaymentRevenue > 0) {
        paymentMethods.forEach(p => {
            p.percentage = Math.round((p.revenue / totalPaymentRevenue) * 100);
        });
    }

    let currentShift = null;
    if (currentShiftRow) {
        currentShift = {
            id: String(currentShiftRow.id),
            userName: String(currentShiftRow.userName),
            expectedStartTime: currentShiftRow.expectedStartTime as Date,
            expectedEndTime: currentShiftRow.expectedEndTime as Date,
        };
    }

    // Pad daily/monthly revenue trend
    let revenueTrend: Array<{ sort: number; label: string; revenue: number }> = [];
    if (period === "month") {
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const trendMap = new Map<number, number>();
        for (let d = 1; d <= daysInMonth; d++) {
            trendMap.set(d, 0);
        }
        for (const row of revenueRows) {
            trendMap.set(Number(row.sort), Number(row.revenue ?? 0));
        }
        revenueTrend = Array.from(trendMap.entries()).map(([day, revenue]) => {
            const label = `${String(day).padStart(2, "0")}/${String(targetMonth).padStart(2, "0")}`;
            return {
                sort: day,
                label,
                revenue,
            };
        });
    } else {
        const trendMap = new Map<number, number>();
        for (let m = 1; m <= 12; m++) {
            trendMap.set(m, 0);
        }
        for (const row of revenueRows) {
            trendMap.set(Number(row.sort), Number(row.revenue ?? 0));
        }
        revenueTrend = Array.from(trendMap.entries()).map(([month, revenue]) => {
            const label = `Tháng ${month}`;
            return {
                sort: month,
                label,
                revenue,
            };
        });
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
        paymentMethods,
        currentShift,
    };
}