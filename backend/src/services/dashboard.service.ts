import {
    getDashboardStats,
    getRecentOrders,
    getRevenueTrend,
    getStockAlerts,
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
    const [stats, revenueRows, topProducts, recentOrders, stockAlerts, paymentMethodRows, currentShiftRow] =
        await Promise.all([
        getDashboardStats(startDate, endDate),
        getRevenueTrend(startDate, endDate),
        getTopProducts(startDate, endDate),
        getRecentOrders(startDate, endDate),
        getStockAlerts(),
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

    return {
        stats: {
        todayRevenue: Number(stats.todayRevenue ?? 0),
        todayOrders: Number(stats.todayOrders ?? 0),
        activeCategories: Number(stats.activeCategories ?? 0),
        lowStockProducts: Number(stats.lowStockProducts ?? 0),
        totalCustomers: Number(stats.totalCustomers ?? 0),
        activeProducts: Number(stats.activeProducts ?? 0),
        totalStockValue: Number(stats.totalStockValue ?? 0),
        },
        revenueTrend: revenueRows.map(row => ({
            sort: Number(row.sort),
            label: String(row.label),
            revenue: Number(row.revenue ?? 0),
        })),
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
        stockAlerts: stockAlerts.map((item) => ({
        name: String(item.name),
        stockQuantity: Number(item.stockQuantity ?? 0),
        minStock: Number(item.minStock ?? 0),
        })),
        paymentMethods,
        currentShift,
    };
}