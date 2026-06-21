import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type { DashboardRevenuePeriod } from "../types/dashboard.types";

export type RevenueTrendRow = RowDataPacket & {
    sort: number;
    label: string;
    revenue: string;
};

export async function getDashboardStats(startDate?: string, endDate?: string) {
    let dateCondition = "DATE(created_at) = CURDATE()";
    let params: string[] = [];

    if (startDate && endDate) {
        dateCondition = "DATE(created_at) >= ? AND DATE(created_at) <= ?";
        params = [startDate, endDate, startDate, endDate];
    }

    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        (SELECT COALESCE(SUM(final_amount), 0)
        FROM orders
        WHERE status = 'completed'
          AND ${dateCondition}
        ) AS todayRevenue,

        (SELECT COUNT(*)
        FROM orders
        WHERE status = 'completed'
          AND ${dateCondition}
        ) AS todayOrders,

        (SELECT COUNT(*)
        FROM categories
        WHERE is_active = TRUE) AS activeCategories,

        (SELECT COUNT(*)
        FROM raw_materials
        WHERE stock_quantity <= min_stock AND is_active = 1) AS lowStockProducts,

        (SELECT COUNT(*)
        FROM customers) AS totalCustomers,

        (SELECT COUNT(*)
        FROM products
        WHERE status = 'active') AS activeProducts,

        (
          (SELECT COALESCE(SUM(stock_quantity * import_price), 0) FROM raw_materials WHERE is_active = 1)
          +
          (SELECT COALESCE(SUM(stock_quantity * import_price), 0) FROM products WHERE requires_preparation = 0 AND status = 'active')
        ) AS totalStockValue
    `, params);

    return rows[0];
}

export async function getRevenueTrend(startDate?: string, endDate?: string) {
    let dateCondition = "MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())";
    let params: string[] = [];

    if (startDate && endDate) {
        dateCondition = "DATE(created_at) >= ? AND DATE(created_at) <= ?";
        params = [startDate, endDate];
    }

    const [rows] = await db.execute<RevenueTrendRow[]>(`
        SELECT
        DATE(created_at) as orderDate,
        DAY(created_at) AS sort,
        DATE_FORMAT(created_at, '%d/%m') AS label,
        COALESCE(SUM(final_amount), 0) AS revenue
        FROM orders
        WHERE status = 'completed'
        AND ${dateCondition}
        GROUP BY DATE(created_at), DAY(created_at), DATE_FORMAT(created_at, '%d/%m')
        ORDER BY DATE(created_at) ASC
    `, params);

    return rows;
}

export async function getTopProducts(startDate?: string, endDate?: string) {
    let dateCondition = "1=1";
    let params: string[] = [];
    if (startDate && endDate) {
        dateCondition = "DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?";
        params = [startDate, endDate];
    }

    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        p.name,
        p.image_url AS imageUrl,
        SUM(od.quantity) AS soldQuantity,
        SUM(od.line_total) AS revenue
        FROM order_details od
        JOIN orders o ON o.id = od.order_id
        JOIN products p ON p.id = od.product_id
        WHERE o.status = 'completed' AND ${dateCondition}
        GROUP BY p.id, p.name, p.image_url
        ORDER BY soldQuantity DESC
        LIMIT 5
    `, params);

    return rows;
}

export async function getRecentOrders(startDate?: string, endDate?: string) {
    let dateCondition = "1=1";
    let params: string[] = [];
    if (startDate && endDate) {
        dateCondition = "DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?";
        params = [startDate, endDate];
    }

    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        o.id,
        COALESCE(c.full_name, 'Khách lẻ') AS customerName,
        o.final_amount AS finalAmount,
        o.status,
        o.created_at AS createdAt
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE ${dateCondition}
        ORDER BY o.created_at DESC
        LIMIT 5
    `, params);

    return rows;
}

export async function getStockAlerts() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        name AS name,
        stock_quantity AS stockQuantity,
        min_stock AS minStock
        FROM raw_materials
        WHERE stock_quantity <= min_stock
          AND is_active = 1
        ORDER BY (stock_quantity - min_stock) ASC
        LIMIT 5
    `);

    return rows;
}

export async function getPaymentMethodStats(startDate?: string, endDate?: string) {
    let dateCondition = "1=1";
    let params: string[] = [];
    if (startDate && endDate) {
        dateCondition = "DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?";
        params = [startDate, endDate];
    }

    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        p.payment_method as method,
        COALESCE(SUM(p.amount), 0) AS revenue,
        COUNT(DISTINCT o.id) AS ordersCount
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE o.status = 'completed' AND p.payment_status = 'paid' AND ${dateCondition}
        GROUP BY p.payment_method
    `, params);

    return rows;
}

export async function getCurrentActiveShift() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        s.id,
        u.full_name AS userName,
        s.expected_start_time AS expectedStartTime,
        s.expected_end_time AS expectedEndTime
        FROM shifts s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'OPEN'
        ORDER BY s.expected_start_time DESC
        LIMIT 1
    `);
    
    return rows.length > 0 ? rows[0] : null;
}