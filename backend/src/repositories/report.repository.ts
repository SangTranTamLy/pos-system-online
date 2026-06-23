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
      DATE_FORMAT(o.created_at, '%d/%m') AS label,
      DATE(o.created_at) as order_date,
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
    GROUP BY DATE(o.created_at), DATE_FORMAT(o.created_at, '%d/%m')
    ORDER BY order_date ASC
    `,
    params
  );

  return rows.map((row) => {
    const revenue = Number(row.revenue);
    const cogs = Number(row.cogs);
    return {
      label: row.label,
      revenue,
      cogs,
      profit: revenue - cogs
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
