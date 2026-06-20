import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type { AuditLog, AuditLogQuery } from "../types/audit-log.types";

export async function getAuditLogs(
  query: AuditLogQuery & { shiftId?: string; actionType?: string }
): Promise<{ logs: AuditLog[]; total: number }> {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  // 1. Lọc theo ca làm việc (Lấy khoảng thời gian của ca đó)
  if (query.shiftId) {
    const [shiftRows] = await db.execute<RowDataPacket[]>(
      `SELECT 
        COALESCE(actual_start_time, expected_start_time) AS startTime,
        COALESCE(actual_end_time, NOW()) AS endTime
       FROM shifts 
       WHERE id = ? 
       LIMIT 1`,
      [query.shiftId]
    );

    if (shiftRows.length > 0) {
      const startTime = shiftRows[0].startTime;
      const endTime = shiftRows[0].endTime;
      conditions.push("a.timestamp >= ? AND a.timestamp <= ?");
      params.push(startTime, endTime);
    }
  }

  // 2. Lọc theo khoảng ngày
  if (query.startDate) {
    conditions.push("DATE(a.timestamp) >= ?");
    params.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push("DATE(a.timestamp) <= ?");
    params.push(query.endDate);
  }

  // 3. Lọc theo loại hành động cụ thể (actionType)
  if (query.actionType) {
    conditions.push("a.action_type = ?");
    params.push(query.actionType);
  }

  // 4. Tìm kiếm theo tên nhân viên, loại hành động, đối tượng hoặc mô tả chi tiết
  if (query.search) {
    conditions.push(
      "(a.user_name LIKE ? OR a.action_type LIKE ? OR a.target_object LIKE ? OR a.description LIKE ?)"
    );
    const searchValue = `%${query.search}%`;
    params.push(searchValue, searchValue, searchValue, searchValue);
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  // 1. Tính tổng số dòng
  const [countRows] = await db.execute<RowDataPacket[]>(
    `
    SELECT COUNT(*) as total 
    FROM audit_logs a
    ${whereClause}
    `,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  // 2. Lấy danh sách phân trang (sử dụng inlined limit/offset để tránh lỗi binding của MySQL prepared statements)
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT 
      a.id,
      a.timestamp,
      a.user_id AS userId,
      a.user_name AS userName,
      a.role,
      a.action_type AS actionType,
      a.target_object AS targetObject,
      a.description,
      a.old_values AS oldValues,
      a.new_values AS newValues
    FROM audit_logs a
    ${whereClause}
    ORDER BY a.timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    params
  );

  const logs = rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : new Date(row.timestamp).toISOString(),
    userId: row.userId,
    userName: row.userName,
    role: row.role,
    actionType: row.actionType,
    targetObject: row.targetObject,
    description: row.description,
    oldValues: row.oldValues,
    newValues: row.newValues
  }));

  return { logs, total };
}

export async function createAuditLog(
  userId: string,
  actionType: string,
  targetObject: string,
  description: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  try {
    const [userRows] = await db.execute<RowDataPacket[]>(
      `SELECT u.full_name, r.name AS role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? 
       LIMIT 1`,
      [userId]
    );

    const userFullName = userRows[0]?.full_name || "Nhân viên";
    const rawRole = userRows[0]?.role_name || "staff";
    const userRole = rawRole.trim().toLowerCase() === "admin" || rawRole.trim().toLowerCase() === "manager" ? "QL" : "TN";

    const { randomUUID } = await import("crypto");
    const oldJson = oldValues ? JSON.stringify(oldValues) : null;
    const newJson = newValues ? JSON.stringify(newValues) : null;

    await db.execute(
      `
      INSERT INTO audit_logs (id, user_id, user_name, role, action_type, target_object, description, old_values, new_values)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        userId,
        userFullName,
        userRole,
        actionType,
        targetObject,
        description,
        oldJson,
        newJson
      ]
    );
  } catch (error) {
    console.error("Lỗi khi ghi nhận nhật ký hệ thống:", error);
  }
}

