import { randomUUID } from "crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type CustomerRow = RowDataPacket & {
  id: string;
  loyalty_points: number;
  total_spent: string;
};

export async function findCustomerById(
  connection: PoolConnection,
  customerId: string
): Promise<CustomerRow | null> {
  const [rows] = await connection.execute<CustomerRow[]>(
    `
    SELECT id, loyalty_points, total_spent
    FROM customers
    WHERE id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [customerId]
  );

  return rows[0] ?? null;
}

export async function updateCustomerAfterOrder(
  connection: PoolConnection,
  customerId: string,
  finalAmount: number,
  pointsEarned: number,
  pointsUsed: number
): Promise<void> {
  await connection.execute(
    `
    UPDATE customers
    SET
      loyalty_points = loyalty_points + ? - ?,
      total_spent = total_spent + ?
    WHERE id = ?
    `,
    [pointsEarned, pointsUsed, finalAmount, customerId]
  );
}

export async function recordPointsTransaction(
  connection: PoolConnection,
  customerId: string,
  orderId: string,
  points: number,
  transactionType: "earn" | "redeem"
): Promise<void> {
  await connection.execute(
    `
    INSERT INTO customer_points (
      id,
      customer_id,
      order_id,
      points,
      transaction_type,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      customerId,
      orderId,
      points,
      transactionType,
      transactionType === "earn"
        ? "Tích điểm từ đơn hàng"
        : "Sử dụng điểm giảm giá",
    ]
  );
}
