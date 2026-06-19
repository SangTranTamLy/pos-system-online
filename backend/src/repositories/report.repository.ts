import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type { EmployeeRevenueReport } from "../types/report.types";

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
