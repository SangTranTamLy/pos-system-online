import { db } from "../config/database";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { Shift } from "../types/shift.types";

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
