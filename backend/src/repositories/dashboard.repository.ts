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
        FROM raw_materials) AS totalMaterials,

        (SELECT COUNT(*)
        FROM customers) AS totalCustomers,

        (SELECT COUNT(*)
        FROM products
        WHERE status = 'active') AS activeProducts,

        (SELECT COALESCE(SUM(stock_quantity * import_price), 0)
         FROM raw_materials
         WHERE is_active = 1) AS totalStockValue
    `, params);

    return rows[0];
}

export async function getRevenueTrend(
    period: DashboardRevenuePeriod,
    year: number,
    month?: number,
    day?: number
) {
    if (period === "week") {
        const endDate = `${year}-${String(month ?? 1).padStart(2, "0")}-${String(day ?? 1).padStart(2, "0")}`;
        const [rows] = await db.execute<RowDataPacket[]>(`
            SELECT
            TO_DAYS(DATE(created_at)) AS sort,
            DATE_FORMAT(created_at, '%Y-%m-%d') AS label,
            COALESCE(SUM(final_amount), 0) AS revenue
            FROM orders
            WHERE status = 'completed'
              AND DATE(created_at) BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
            GROUP BY DATE(created_at), TO_DAYS(DATE(created_at)), DATE_FORMAT(created_at, '%Y-%m-%d')
            ORDER BY DATE(created_at) ASC
        `, [endDate, endDate]);
        return rows;
    } else {
        const endMonth = month ?? 12;
        const endDate = new Date(year, endMonth, 0);
        const startDate = new Date(year, endMonth - 12, 1);
        const startDateInput = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;
        const endDateInput = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

        const [rows] = await db.execute<RowDataPacket[]>(`
            SELECT
            YEAR(created_at) * 100 + MONTH(created_at) AS sort,
            DATE_FORMAT(created_at, '%Y-%m') AS label,
            COALESCE(SUM(final_amount), 0) AS revenue
            FROM orders
            WHERE status = 'completed'
              AND DATE(created_at) BETWEEN ? AND ?
            GROUP BY YEAR(created_at) * 100 + MONTH(created_at), DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY sort ASC
        `, [startDateInput, endDateInput]);
        return rows;
    }
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

export async function getRecentMaterials() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
        name AS name,
        sku AS sku,
        category AS category,
        import_price AS importPrice
        FROM raw_materials
        ORDER BY created_at DESC
        LIMIT 5
    `);

    return rows;
}

export async function getLowStockItems() {
    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
          id,
          name,
          COALESCE(sku, '') AS sku,
          'material' AS type,
          COALESCE(stock_quantity, 0) AS stockQuantity,
          5 AS threshold,
          unit
        FROM raw_materials
        WHERE is_active = 1
          AND COALESCE(stock_quantity, 0) <= 5

        ORDER BY stockQuantity ASC, name ASC
        LIMIT 8
    `);

    return rows;
}

export async function getCategorySales(startDate?: string, endDate?: string) {
    let dateCondition = "1=1";
    let params: string[] = [];
    if (startDate && endDate) {
        dateCondition = "DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?";
        params = [startDate, endDate];
    }

    const [rows] = await db.execute<RowDataPacket[]>(`
        SELECT
          c.name,
          c.image_url AS imageUrl,
          COALESCE(SUM(od.quantity), 0) AS quantity,
          COALESCE(SUM(od.line_total), 0) AS revenue
        FROM order_details od
        JOIN orders o ON o.id = od.order_id
        JOIN products p ON p.id = od.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status = 'completed'
          AND ${dateCondition}
        GROUP BY c.id, c.name, c.image_url
        ORDER BY revenue DESC
        LIMIT 6
    `, params);

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
