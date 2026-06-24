import { db } from "../config/database";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { Shift, ShiftBucketKey } from "../types/shift.types";

type ShiftRow = RowDataPacket & {
  id: string;
  user_id: string;
  expected_start_time: Date;
  expected_end_time: Date;
  actual_start_time: Date | null;
  actual_end_time: Date | null;
  status: string;
  approved_by: string | null;
  opened_by: string | null;
  closed_by: string | null;
  opening_cash: string;
  actual_closing_cash: string;
  total_sales_cash: string;
  total_sales_qr: string;
  total_sales: string;
  variance: string;
  closing_note: string | null;
  created_at: Date;
  updated_at: Date;
  
  user_name?: string;
  approved_by_name?: string;
  opened_by_name?: string;
  closed_by_name?: string;
};

type ShiftRevenueRow = RowDataPacket & {
  work_date: string | Date;
  shift_bucket: ShiftBucketKey;
  revenue: string | number | null;
};

type StaffByShiftRow = RowDataPacket & {
  shift_bucket: ShiftBucketKey;
  assigned: number;
};

function formatDateKey(value: string | Date): string {
  if (typeof value === "string") return value;
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapRowToShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    userId: row.user_id,
    expectedStartTime: row.expected_start_time.toISOString(),
    expectedEndTime: row.expected_end_time.toISOString(),
    actualStartTime: row.actual_start_time?.toISOString() || null,
    actualEndTime: row.actual_end_time?.toISOString() || null,
    status: row.status as any,
    approvedBy: row.approved_by,
    openedBy: row.opened_by,
    closedBy: row.closed_by,
    openingCash: parseFloat(row.opening_cash),
    actualClosingCash: parseFloat(row.actual_closing_cash),
    totalSalesCash: parseFloat(row.total_sales_cash),
    totalSalesQr: parseFloat(row.total_sales_qr),
    totalSales: parseFloat(row.total_sales),
    variance: parseFloat(row.variance),
    closingNote: row.closing_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    userName: row.user_name,
    approvedByName: row.approved_by_name,
    openedByName: row.opened_by_name,
    closedByName: row.closed_by_name,
  };
}

const SELECT_SHIFTS_QUERY = `
  SELECT 
    s.*,
    u.full_name AS user_name,
    ua.full_name AS approved_by_name,
    uo.full_name AS opened_by_name,
    uc.full_name AS closed_by_name
  FROM shifts s
  JOIN users u ON s.user_id = u.id
  LEFT JOIN users ua ON s.approved_by = ua.id
  LEFT JOIN users uo ON s.opened_by = uo.id
  LEFT JOIN users uc ON s.closed_by = uc.id
`;

export const findShiftById = async (id: string): Promise<Shift | null> => {
  const [rows] = await db.execute<ShiftRow[]>(
    `${SELECT_SHIFTS_QUERY} WHERE s.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  return mapRowToShift(rows[0]);
};

export const findShifts = async (userId?: string): Promise<Shift[]> => {
  let query = SELECT_SHIFTS_QUERY;
  const params: any[] = [];
  
  if (userId) {
    query += ` WHERE s.user_id = ?`;
    params.push(userId);
  }
  
  query += ` ORDER BY s.expected_start_time DESC`;
  
  const [rows] = await db.execute<ShiftRow[]>(query, params);
  return rows.map(mapRowToShift);
};

export const createShift = async (
  id: string,
  userId: string,
  expectedStartTime: Date,
  expectedEndTime: Date
): Promise<void> => {
  await db.execute<ResultSetHeader>(
    `INSERT INTO shifts (id, user_id, expected_start_time, expected_end_time, status)
     VALUES (?, ?, ?, ?, 'PENDING')`,
    [id, userId, expectedStartTime, expectedEndTime]
  );
};

export const createOpenShiftForEmployee = async (
  id: string,
  userId: string,
  expectedStartTime: Date,
  expectedEndTime: Date,
  managerId: string,
  openingCash: number
): Promise<void> => {
  await db.execute<ResultSetHeader>(
    `INSERT INTO shifts (
       id, user_id, expected_start_time, expected_end_time, status,
       opened_by, actual_start_time, opening_cash
     )
     VALUES (?, ?, ?, ?, 'OPEN', ?, NOW(), ?)`,
    [id, userId, expectedStartTime, expectedEndTime, managerId, openingCash]
  );
};

export const checkOpenShiftExists = async (userId: string): Promise<boolean> => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN'`,
    [userId]
  );
  return rows.length > 0;
};

export const checkOverlappingShifts = async (
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id FROM shifts 
     WHERE user_id = ? 
     AND status NOT IN ('CANCELLED', 'CLOSED')
     AND (
       (expected_start_time < ? AND expected_end_time > ?)
     )`,
    [userId, endTime, startTime]
  );
  return rows.length > 0;
};

export const updateShiftStatus = async (
  id: string,
  status: string,
  updates: Record<string, any> = {}
): Promise<void> => {
  const setClauses = ['status = ?'];
  const params: any[] = [status];
  
  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    params.push(value);
  }
  params.push(id);
  
  const query = `UPDATE shifts SET ${setClauses.join(', ')} WHERE id = ?`;
  await db.execute<ResultSetHeader>(query, params);
};

export const calculateShiftSales = async (
  shiftId: string
): Promise<{ totalCash: number; totalQr: number }> => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT p.payment_method, SUM(p.amount) as total
     FROM payments p
     JOIN orders o ON p.order_id = o.id
     WHERE o.shift_id = ? AND p.payment_status = 'paid'
     GROUP BY p.payment_method`,
    [shiftId]
  );
  
  let totalCash = 0;
  let totalQr = 0;
  
  for (const row of rows) {
    if (row.payment_method === 'cash') totalCash += parseFloat(row.total);
    if (row.payment_method === 'qr' || row.payment_method === 'card') totalQr += parseFloat(row.total);
  }
  
  return { totalCash, totalQr };
};

export const findShiftRevenueByBucket = async (
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; bucket: ShiftBucketKey; revenue: number }>> => {
  const [rows] = await db.execute<ShiftRevenueRow[]>(
    `SELECT
       DATE(COALESCE(s.actual_start_time, s.expected_start_time)) AS work_date,
       CASE
         WHEN HOUR(COALESCE(s.actual_start_time, s.expected_start_time)) >= 6
          AND HOUR(COALESCE(s.actual_start_time, s.expected_start_time)) < 14 THEN 'morning'
         WHEN HOUR(COALESCE(s.actual_start_time, s.expected_start_time)) >= 14
          AND HOUR(COALESCE(s.actual_start_time, s.expected_start_time)) < 22 THEN 'afternoon'
         ELSE 'night'
       END AS shift_bucket,
       SUM(
         CASE
           WHEN s.status = 'CLOSED' THEN s.total_sales
           ELSE COALESCE(pay.total_paid, 0)
         END
       ) AS revenue
     FROM shifts s
     LEFT JOIN (
       SELECT o.shift_id, SUM(p.amount) AS total_paid
       FROM orders o
       JOIN payments p ON p.order_id = o.id
       WHERE p.payment_status = 'paid'
       GROUP BY o.shift_id
     ) pay ON pay.shift_id = s.id
     WHERE DATE(COALESCE(s.actual_start_time, s.expected_start_time)) BETWEEN ? AND ?
       AND s.status <> 'CANCELLED'
     GROUP BY work_date, shift_bucket
     ORDER BY work_date ASC`,
    [startDate, endDate]
  );

  return rows.map((row) => ({
    date: formatDateKey(row.work_date),
    bucket: row.shift_bucket,
    revenue: Number(row.revenue || 0),
  }));
};

export const countStaffByShiftBucket = async (
  date: string
): Promise<Array<{ bucket: ShiftBucketKey; assigned: number }>> => {
  const [rows] = await db.execute<StaffByShiftRow[]>(
    `SELECT
       CASE
         WHEN HOUR(expected_start_time) >= 6 AND HOUR(expected_start_time) < 14 THEN 'morning'
         WHEN HOUR(expected_start_time) >= 14 AND HOUR(expected_start_time) < 22 THEN 'afternoon'
         ELSE 'night'
       END AS shift_bucket,
       COUNT(DISTINCT user_id) AS assigned
     FROM shifts
     WHERE DATE(expected_start_time) = ?
       AND status <> 'CANCELLED'
     GROUP BY shift_bucket`,
    [date]
  );

  return rows.map((row) => ({
    bucket: row.shift_bucket,
    assigned: Number(row.assigned || 0),
  }));
};

export const countActiveShiftStaff = async (): Promise<number> => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = TRUE
       AND UPPER(r.name) IN ('STAFF', 'CASHIER', 'NHAN_VIEN', 'NHAN VIEN')`
  );

  return Number(rows[0]?.total || 0);
};
