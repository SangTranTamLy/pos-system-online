import {
    getDashboardStats,
    getRecentOrders,
    getRevenueByPeriod,
    getStockAlerts,
    getTopProducts,
    type RevenueTrendRow,
} from "../repositories/dashboard.repository";
import type { DashboardRevenuePeriod } from "../types/dashboard.types";

function formatMonthDayLabel(day: number) {
    const today = new Date();
    const month = today.getMonth() + 1;

    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function normalizeRevenueTrend(rows: RevenueTrendRow[], period: DashboardRevenuePeriod) {
    const revenueBySort = new Map(
        rows.map((item) => [Number(item.sort), Number(item.revenue ?? 0)])
    );

    if (period === "year") {
        return Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;

            return {
                sort: month,
                label: `Tháng ${month}`,
                revenue: revenueBySort.get(month) ?? 0,
            };
        });
    }

    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;

        return {
            sort: day,
            label: formatMonthDayLabel(day),
            revenue: revenueBySort.get(day) ?? 0,
        };
    });
}

export async function getDashboardSummaryService(period: DashboardRevenuePeriod = "month") {
    const [stats, revenueRows, topProducts, recentOrders, stockAlerts] =
        await Promise.all([
        getDashboardStats(),
        getRevenueByPeriod(period),
        getTopProducts(),
        getRecentOrders(),
        getStockAlerts(),
        ]);

    return {
        stats: {
        todayRevenue: Number(stats.todayRevenue ?? 0),
        todayOrders: Number(stats.todayOrders ?? 0),
        activeCategories: Number(stats.activeCategories ?? 0),
        lowStockProducts: Number(stats.lowStockProducts ?? 0),
        totalCustomers: Number(stats.totalCustomers ?? 0),
        activeProducts: Number(stats.activeProducts ?? 0),
        },
        revenueTrend: normalizeRevenueTrend(revenueRows, period),
        topProducts: topProducts.map((item) => ({
        name: String(item.name),
        soldQuantity: Number(item.soldQuantity ?? 0),
        revenue: Number(item.revenue ?? 0),
        })),
        recentOrders: recentOrders.map((item) => ({
        id: String(item.id),
        customerName: String(item.customerName),
        finalAmount: Number(item.finalAmount ?? 0),
        status: String(item.status),
        createdAt: item.createdAt,
        })),
        stockAlerts: stockAlerts.map((item) => ({
        productName: String(item.productName),
        stockQuantity: Number(item.stockQuantity ?? 0),
        })),
    };
}