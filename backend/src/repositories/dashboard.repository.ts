import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type { DashboardRevenuePeriod } from "../types/dashboard.types";

export type RevenueTrendRow = RowDataPacket & {
    sort: number;
    label: string;
    revenue: string;
};

export async function getDashboardStats() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        (SELECT COALESCE(SUM(final_amount), 0)
        FROM orders
        WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE()) AS todayRevenue,

        (SELECT COUNT(*)
        FROM orders
        WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE()) AS todayOrders,

        (SELECT COUNT(*)
        FROM categories
        WHERE is_active = TRUE) AS activeCategories,

        (SELECT COUNT(*)
        FROM products
        WHERE stock_quantity > 0 AND stock_quantity <= 10) AS lowStockProducts,

        (SELECT COUNT(*)
        FROM customers) AS totalCustomers,

        (SELECT COUNT(*)
        FROM products
        WHERE status = 'active') AS activeProducts
    `);

    return rows[0];
}

export async function getRevenueByPeriod(period: DashboardRevenuePeriod) {
    if (period === "year") {
        const [rows] = await db.execute<RevenueTrendRow[]>(`
        SELECT
        revenue_by_month.sort,
        CONCAT('Tháng ', revenue_by_month.sort) AS label,
        revenue_by_month.revenue
        FROM (
            SELECT
            MONTH(created_at) AS sort,
            COALESCE(SUM(final_amount), 0) AS revenue
            FROM orders
            WHERE status = 'completed'
            AND YEAR(created_at) = YEAR(CURRENT_DATE())
            GROUP BY MONTH(created_at)
        ) AS revenue_by_month
        ORDER BY revenue_by_month.sort ASC
    `);

        return rows;
    }

    const [rows] = await db.execute<RevenueTrendRow[]>(`
        SELECT
        revenue_by_day.sort,
        DATE_FORMAT(revenue_by_day.orderDate, '%d/%m') AS label,
        revenue_by_day.revenue
        FROM (
            SELECT
            DATE(created_at) AS orderDate,
            DAY(created_at) AS sort,
            COALESCE(SUM(final_amount), 0) AS revenue
            FROM orders
            WHERE status = 'completed'
            AND MONTH(created_at) = MONTH(CURRENT_DATE())
            AND YEAR(created_at) = YEAR(CURRENT_DATE())
            GROUP BY DATE(created_at), DAY(created_at)
        ) AS revenue_by_day
        ORDER BY revenue_by_day.sort ASC
    `);

    return rows;
}

export async function getTopProducts() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        p.name,
        SUM(od.quantity) AS soldQuantity,
        SUM(od.line_total) AS revenue
        FROM order_details od
        JOIN orders o ON o.id = od.order_id
        JOIN products p ON p.id = od.product_id
        WHERE o.status = 'completed'
        GROUP BY p.id, p.name
        ORDER BY soldQuantity DESC
        LIMIT 5
    `);

    return rows;
}

export async function getRecentOrders() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        o.id,
        COALESCE(c.full_name, 'Khách lẻ') AS customerName,
        o.final_amount AS finalAmount,
        o.status,
        o.created_at AS createdAt
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        ORDER BY o.created_at DESC
        LIMIT 5
    `);

    return rows;
}

export async function getStockAlerts() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        name AS productName,
        stock_quantity AS stockQuantity
        FROM products
        WHERE stock_quantity <= 10
        ORDER BY stock_quantity ASC
        LIMIT 5
    `);

    return rows;
}