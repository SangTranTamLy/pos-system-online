import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type { 
  EmployeeRevenueReport, 
  FinancialReportData, 
  FinancialTrendPoint,
  ProductValuation,
  CategoryValuation,
  EmployeePerformanceReport,
  CustomerRetentionReport
} from "../types/report.types";

type EmployeeRevenueRow = RowDataPacket & EmployeeRevenueReport;

export async function getRevenueAllEmployees(
  startDate?: string,
  endDate?: string
): Promise<EmployeeRevenueReport[]> {
  const conditions: string[] = ["o.status = 'completed'"];
  const params: string[] = [];

  if (startDate) {
    conditions.push("DATE(o.created_at) >= ?");
    params.push(startDate);
  }

  if (endDate) {
    conditions.push("DATE(o.created_at) <= ?");
    params.push(endDate);
  }

  const onClause = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";

  const [rows] = await db.execute<EmployeeRevenueRow[]>(
    `
    SELECT
      u.id,
      u.full_name,
      u.role_id,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.final_amount), 0) as total_revenue
    FROM users u
    LEFT JOIN orders o ON o.created_by = u.id ${onClause}
    GROUP BY u.id, u.full_name, u.role_id
    ORDER BY total_revenue DESC
  `,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    role_id: row.role_id,
    total_orders: Number(row.total_orders),
    total_revenue: Number(row.total_revenue),
  }));
}

export async function getRevenueByEmployeeId(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<EmployeeRevenueReport[]> {
  const conditions: string[] = ["o.status = 'completed'"];
  const params: string[] = [userId];

  if (startDate) {
    conditions.push("DATE(o.created_at) >= ?");
    params.push(startDate);
  }

  if (endDate) {
    conditions.push("DATE(o.created_at) <= ?");
    params.push(endDate);
  }

  const onClause = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";

  const [rows] = await db.execute<EmployeeRevenueRow[]>(
    `
    SELECT
      u.id,
      u.full_name,
      u.role_id,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.final_amount), 0) as total_revenue
    FROM users u
    LEFT JOIN orders o ON o.created_by = u.id ${onClause}
    WHERE u.id = ?
    GROUP BY u.id, u.full_name, u.role_id
  `,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    role_id: row.role_id,
    total_orders: Number(row.total_orders),
    total_revenue: Number(row.total_revenue),
  }));
}

// Helper sinh câu điều kiện ngày tháng
function getDateConditions(tableAlias: string, startDate?: string, endDate?: string) {
  const conditions: string[] = [];
  const params: string[] = [];
  if (startDate) {
    conditions.push(`DATE(${tableAlias}.created_at) >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`DATE(${tableAlias}.created_at) <= ?`);
    params.push(endDate);
  }
  return {
    clause: conditions.length > 0 ? "AND " + conditions.join(" AND ") : "",
    params
  };
}
// AI báo cáo doanh thu theo giờ
export async function getAiHourlyRevenue(startDate: string, endDate: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      HOUR(o.created_at) AS hour,
      COUNT(o.id) AS ordersCount,
      COALESCE(SUM(o.final_amount), 0) AS revenue
    FROM orders o
    WHERE o.status = 'completed'
      AND DATE(o.created_at) >= ?
      AND DATE(o.created_at) <= ?
    GROUP BY HOUR(o.created_at)
    ORDER BY hour ASC
    `,
    [startDate, endDate]
  );

  return rows.map((row) => ({
    hour: Number(row.hour),
    label: `${String(row.hour).padStart(2, "0")}:00-${String(Number(row.hour) + 1).padStart(2, "0")}:00`,
    ordersCount: Number(row.ordersCount),
    revenue: Number(row.revenue),
  }));
}
//Sản phẩm bán ra
export async function getAiSoldProducts(startDate: string, endDate: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      p.id,
      p.name,
      p.stock_quantity AS stockQuantity,
      p.is_tracked_stock AS isTrackedStock,
      COALESCE(SUM(od.quantity), 0) AS soldQuantity,
      COALESCE(
        SUM(
          od.line_total *
          CASE
            WHEN o.total_amount > 0 THEN o.final_amount / o.total_amount
            ELSE 1
          END
        ),
        0
      ) AS revenue
    FROM order_details od
    JOIN orders o ON o.id = od.order_id
    JOIN products p ON p.id = od.product_id
    WHERE o.status = 'completed'
      AND DATE(o.created_at) >= ?
      AND DATE(o.created_at) <= ?
    GROUP BY p.id, p.name, p.stock_quantity, p.is_tracked_stock
    ORDER BY soldQuantity DESC
    `,
    [startDate, endDate]
  );

  return rows.map((row) => ({
    productId: row.id,
    name: row.name,
    soldQuantity: Number(row.soldQuantity),
    revenue: Number(row.revenue),
    stockQuantity: row.stockQuantity === null ? null : Number(row.stockQuantity),
    isTrackedStock: Boolean(row.isTrackedStock),
  }));
}
//Sản phẩm bán chậm
export async function getAiCategoryRevenue(startDate: string, endDate: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      c.id AS categoryId,
      c.name AS categoryName,
      COALESCE(SUM(od.quantity), 0) AS soldQuantity,
      COALESCE(
        SUM(
          od.line_total *
          CASE
            WHEN o.total_amount > 0 THEN o.final_amount / o.total_amount
            ELSE 1
          END
        ),
        0
      ) AS revenue
    FROM order_details od
    JOIN orders o ON o.id = od.order_id
    JOIN products p ON p.id = od.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE o.status = 'completed'
      AND DATE(o.created_at) >= ?
      AND DATE(o.created_at) <= ?
    GROUP BY c.id, c.name
    ORDER BY revenue DESC
    LIMIT 10
    `,
    [startDate, endDate]
  );

  const data = rows.map((row) => ({
    categoryId: String(row.categoryId),
    categoryName: String(row.categoryName),
    soldQuantity: Number(row.soldQuantity),
    revenue: Number(row.revenue),
    percentage: 0,
  }));

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  return data.map((item) => ({
    ...item,
    percentage: totalRevenue > 0 ? Number(((item.revenue / totalRevenue) * 100).toFixed(1)) : 0,
  }));
}

export async function getAiSlowProducts(startDate: string, endDate: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      p.id,
      p.name,
      COALESCE(sales.soldQuantity, 0) AS soldQuantity,
      p.stock_quantity AS stockQuantity
    FROM products p
    LEFT JOIN (
      SELECT
        od.product_id,
        SUM(od.quantity) AS soldQuantity
      FROM order_details od
      JOIN orders o ON o.id = od.order_id
      WHERE o.status = 'completed'
        AND DATE(o.created_at) >= ?
        AND DATE(o.created_at) <= ?
      GROUP BY od.product_id
    ) sales ON sales.product_id = p.id
    WHERE p.status = 'active'
    ORDER BY soldQuantity ASC, p.name ASC
    LIMIT 10
    `,
    [startDate, endDate]
  );

  return rows.map((row) => ({
    productId: row.id,
    name: row.name,
    soldQuantity: Number(row.soldQuantity),
    stockQuantity: row.stockQuantity === null ? null : Number(row.stockQuantity),
  }));
}
// Thanh toán theo phương thức
export async function getAiPaymentSummary(startDate: string, endDate: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      p.payment_method AS method,
      COUNT(DISTINCT p.order_id) AS ordersCount,
      COALESCE(SUM(p.amount), 0) AS amount
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.status = 'completed'
      AND p.payment_status = 'paid'
      AND DATE(o.created_at) >= ?
      AND DATE(o.created_at) <= ?
    GROUP BY p.payment_method
    `,
    [startDate, endDate]
  );

  return rows.map((row) => ({
    method: row.method,
    ordersCount: Number(row.ordersCount),
    amount: Number(row.amount),
  }));
}
// Đơn hủy/sửa bất thường
export async function getAiCancelledOrders(startDate: string, endDate: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      id,
      final_amount AS finalAmount,
      cancel_reason AS cancelReason,
      created_at AS createdAt,
      COALESCE(cancelled_at, updated_at, created_at) AS cancelledAt
    FROM orders
    WHERE status = 'cancelled'
      AND (
        (
          DATE(COALESCE(cancelled_at, updated_at, created_at)) >= ?
          AND DATE(COALESCE(cancelled_at, updated_at, created_at)) <= ?
        )
        OR (
          DATE(created_at) >= ?
          AND DATE(created_at) <= ?
        )
      )
    ORDER BY COALESCE(cancelled_at, updated_at, created_at) DESC
    `,
    [startDate, endDate, startDate, endDate]
  );

  return rows.map((row) => ({
    orderId: row.id,
    finalAmount: Number(row.finalAmount || 0),
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
    cancelledAt: row.cancelledAt,
  }));
}
// 1. Báo cáo tài chính: Tổng quan
export async function getFinancialSummary(
  startDate?: string,
  endDate?: string
): Promise<FinancialReportData> {
  const { clause, params } = getDateConditions("o", startDate, endDate);
  
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      COALESCE(SUM(o.final_amount), 0) AS totalRevenue,
      COALESCE(SUM(cogs_query.order_cogs), 0) AS totalCOGS,
      COUNT(o.id) AS totalOrders
    FROM orders o
    LEFT JOIN (
      SELECT od.order_id, SUM(od.quantity * p.import_price) AS order_cogs
      FROM order_details od
      JOIN products p ON od.product_id = p.id
      GROUP BY od.order_id
    ) cogs_query ON o.id = cogs_query.order_id
    WHERE o.status = 'completed' ${clause}
    `,
    params
  );

  const totalRevenue = Number(rows[0]?.totalRevenue || 0);
  const totalCOGS = Number(rows[0]?.totalCOGS || 0);
  const grossProfit = totalRevenue - totalCOGS;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalOrders = Number(rows[0]?.totalOrders || 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    grossProfitMargin,
    totalOrders,
    averageOrderValue
  };
}

// 1b. Báo cáo tài chính: Xu hướng doanh thu & lợi nhuận
export async function getFinancialTrend(
  startDate?: string,
  endDate?: string
): Promise<FinancialTrendPoint[]> {
  const { clause, params } = getDateConditions("o", startDate, endDate);

  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
      DATE_FORMAT(o.created_at, '%d/%m') AS label,
      COALESCE(SUM(o.final_amount), 0) AS revenue,
      COALESCE(SUM(cogs_query.order_cogs), 0) AS cogs
    FROM orders o
    LEFT JOIN (
      SELECT od.order_id, SUM(od.quantity * p.import_price) AS order_cogs
      FROM order_details od
      JOIN products p ON od.product_id = p.id
      GROUP BY od.order_id
    ) cogs_query ON o.id = cogs_query.order_id
    WHERE o.status = 'completed' ${clause}
    GROUP BY
      DATE_FORMAT(o.created_at, '%Y-%m-%d'),
      DATE_FORMAT(o.created_at, '%d/%m')
    ORDER BY DATE_FORMAT(o.created_at, '%Y-%m-%d') ASC
    `,
    params
  );

  return rows.map((row) => {
    const revenue = Number(row.revenue);
    const cogs = Number(row.cogs);
    return {
      date: String(row.date),
      label: String(row.label),
      revenue,
      cogs,
      profit: revenue - cogs,
    };
  });
}

// 2. Báo cáo tồn kho: Giá trị kho thành phẩm (Products)
export async function getProductValuation(): Promise<ProductValuation[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      p.name,
      p.sku,
      c.name AS category,
      'Món' AS unit,
      p.stock_quantity AS stockQuantity,
      p.import_price AS importPrice,
      (p.stock_quantity * p.import_price) AS totalValue
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'active' AND p.is_tracked_stock = 1
    ORDER BY totalValue DESC
    `
  );

  return rows.map((row) => ({
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    stockQuantity: Number(row.stockQuantity),
    importPrice: Number(row.importPrice),
    totalValue: Number(row.totalValue)
  }));
}

// 2b. Báo cáo tồn kho: Giá trị kho nguyên liệu (Raw Materials)
export async function getRawMaterialValuation(): Promise<ProductValuation[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      name,
      sku,
      category,
      unit,
      stock_quantity AS stockQuantity,
      import_price AS importPrice,
      (stock_quantity * import_price) AS totalValue
    FROM raw_materials
    WHERE is_active = TRUE
    ORDER BY totalValue DESC
    `
  );

  return rows.map((row) => ({
    name: row.name,
    sku: row.sku,
    category: row.category || "Chưa phân loại",
    unit: row.unit,
    stockQuantity: Number(row.stockQuantity),
    importPrice: Number(row.importPrice),
    totalValue: Number(row.totalValue)
  }));
}

// 2c. Báo cáo tồn kho: Phân bổ giá trị theo danh mục (Nguyên liệu + Sản phẩm)
export async function getInventoryValuationByCategory(): Promise<CategoryValuation[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      categoryName,
      SUM(totalValue) as totalValue
    FROM (
      SELECT c.name as categoryName, (p.stock_quantity * p.import_price) as totalValue
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'active' AND p.is_tracked_stock = 1
      
      UNION ALL
      
      SELECT COALESCE(category, 'Nguyên liệu') as categoryName, (stock_quantity * import_price) as totalValue
      FROM raw_materials
      WHERE is_active = TRUE
    ) combined
    GROUP BY categoryName
    ORDER BY totalValue DESC
    `
  );

  const data = rows.map((row) => ({
    categoryName: row.categoryName,
    totalValue: Number(row.totalValue),
    percentage: 0
  }));

  const grandTotal = data.reduce((sum, item) => sum + item.totalValue, 0);
  if (grandTotal > 0) {
    data.forEach((item) => {
      item.percentage = Number(((item.totalValue / grandTotal) * 100).toFixed(1));
    });
  }

  return data;
}

// 3. Báo cáo nhân viên: Hiệu suất tổng hợp
export async function getEmployeePerformance(
  startDate?: string,
  endDate?: string
): Promise<EmployeePerformanceReport[]> {
  const { clause: orderClause, params: orderParams } = getDateConditions("o", startDate, endDate);
  const { clause: shiftClause, params: shiftParams } = getDateConditions("s", startDate, endDate);

  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      u.id,
      u.full_name AS fullName,
      COALESCE(shift_count.total_shifts, 0) AS shiftsCount,
      COALESCE(order_count.total_orders, 0) AS totalOrders,
      COALESCE(order_count.total_revenue, 0) AS totalRevenue
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS total_shifts
      FROM shifts s
      WHERE s.status = 'CLOSED' ${shiftClause}
      GROUP BY user_id
    ) shift_count ON u.id = shift_count.user_id
    LEFT JOIN (
      SELECT created_by, COUNT(*) AS total_orders, SUM(final_amount) AS total_revenue
      FROM orders o
      WHERE o.status = 'completed' ${orderClause}
      GROUP BY created_by
    ) order_count ON u.id = order_count.created_by
    WHERE u.is_active = TRUE
    ORDER BY totalRevenue DESC
    `,
    [...shiftParams, ...orderParams]
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    shiftsCount: Number(row.shiftsCount),
    totalOrders: Number(row.totalOrders),
    totalRevenue: Number(row.totalRevenue)
  }));
}

// 4. Báo cáo so sánh tăng trưởng: Doanh thu chu kỳ hiện tại
export async function getRevenueByPeriod(
  startDate: string,
  endDate: string
): Promise<{ date: string; revenue: number }[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      DATE(created_at) as date_val,
      SUM(final_amount) as revenue
    FROM orders
    WHERE status = 'completed' 
      AND DATE(created_at) >= ? 
      AND DATE(created_at) <= ?
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
    `,
    [startDate, endDate]
  );

  return rows.map((row) => ({
    date: new Date(row.date_val).toISOString().split("T")[0],
    revenue: Number(row.revenue)
  }));
}

// 5. Báo cáo khách hàng thân thiết
export async function getCustomerRetention(
  startDate?: string,
  endDate?: string
): Promise<CustomerRetentionReport[]> {
  const { clause, params } = getDateConditions("o", startDate, endDate);

  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      c.id,
      c.full_name AS fullName,
      c.phone,
      COUNT(o.id) AS totalOrders,
      COALESCE(SUM(o.final_amount), 0) AS totalRevenue,
      MAX(o.created_at) AS lastOrderAt
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'completed' ${clause}
    GROUP BY c.id, c.full_name, c.phone
    HAVING totalOrders > 0
    ORDER BY totalRevenue DESC
    `,
    params
  );

  return rows.map((row) => {
    const totalOrders = Number(row.totalOrders);
    const totalRevenue = Number(row.totalRevenue);
    return {
      id: row.id,
      fullName: row.fullName,
      phone: row.phone,
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders) : 0,
      lastOrderAt: row.lastOrderAt ? new Date(row.lastOrderAt).toISOString() : null
    };
  });
}
