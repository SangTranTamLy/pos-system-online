import { randomUUID } from "crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type {
  NormalizedPosOrderItem,
  PosOrderDetail,
  PosOrderResult,
  PosPaymentMethod,
} from "../types/pos.types";
import { ApiError } from "../utils/apiError";

type ProductForSaleRow = RowDataPacket & {
  id: string;
  name: string;
  sale_price: string;
  stock_quantity: number;
  status: "active" | "paused" | "out_of_stock";
};

type CustomerRow = RowDataPacket & {
  id: string;
};

type CreatePosOrderTransactionData = {
  customerId: string | null;
  createdBy: string;
  paymentMethod: PosPaymentMethod;
  note: string | null;
  items: NormalizedPosOrderItem[];
};

async function findCustomerForUpdate(
  connection: PoolConnection,
  customerId: string
) {
  const [rows] = await connection.execute<CustomerRow[]>(
    `
    SELECT id
    FROM customers
    WHERE id = ?
    LIMIT 1
    `,
    [customerId]
  );

  return rows[0] ?? null;
}

async function findProductForUpdate(
  connection: PoolConnection,
  productId: string
) {
  const [rows] = await connection.execute<ProductForSaleRow[]>(
    `
    SELECT id, name, sale_price, stock_quantity, status
    FROM products
    WHERE id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [productId]
  );

  return rows[0] ?? null;
}

export async function createPosOrderTransaction(
  data: CreatePosOrderTransactionData
): Promise<PosOrderResult> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    if (data.customerId) {
      const customer = await findCustomerForUpdate(connection, data.customerId);

      if (!customer) {
        throw new ApiError(404, "KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng");
      }
    }

    const orderId = randomUUID();
    const details: PosOrderDetail[] = [];

    for (const item of data.items) {
      const product = await findProductForUpdate(connection, item.productId);

      if (!product) {
        throw new ApiError(404, "KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m");
      }

      if (product.status !== "active") {
        throw new ApiError(409, `Sáº£n pháº©m "${product.name}" khÃ´ng Ä‘ang bÃ¡n`);
      }

      if (product.stock_quantity < item.quantity) {
        throw new ApiError(409, `Sáº£n pháº©m "${product.name}" khÃ´ng Ä‘á»§ tá»“n kho`);
      }

      const unitPrice = Number(product.sale_price);
      const lineTotal = unitPrice * item.quantity;
      const detailId = randomUUID();

      details.push({
        id: detailId,
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    const totalAmount = details.reduce(
      (total, detail) => total + detail.lineTotal,
      0
    );
    const discountAmount = 0;
    const finalAmount = totalAmount - discountAmount;

    await connection.execute(
      `
      INSERT INTO orders (
        id,
        customer_id,
        created_by,
        status,
        total_amount,
        discount_amount,
        final_amount,
        note
      )
      VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)
      `,
      [
        orderId,
        data.customerId,
        data.createdBy,
        totalAmount,
        discountAmount,
        finalAmount,
        data.note,
      ]
    );

    for (const detail of details) {
      await connection.execute(
        `
        INSERT INTO order_details (
          id,
          order_id,
          product_id,
          quantity,
          unit_price,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          detail.id,
          orderId,
          detail.productId,
          detail.quantity,
          detail.unitPrice,
          detail.lineTotal,
        ]
      );

      await connection.execute(
        `
        UPDATE products
        SET
          stock_quantity = stock_quantity - ?,
          status = CASE
            WHEN stock_quantity - ? <= 0 THEN 'out_of_stock'
            ELSE status
          END
        WHERE id = ?
        `,
        [detail.quantity, detail.quantity, detail.productId]
      );

      await connection.execute(
        `
        INSERT INTO stock_transactions (
          id,
          product_id,
          created_by,
          transaction_type,
          quantity,
          note
        )
        VALUES (?, ?, ?, 'export', ?, ?)
        `,
        [
          randomUUID(),
          detail.productId,
          data.createdBy,
          detail.quantity,
          `BÃ¡n hÃ ng táº¡i quáº§y - Ä‘Æ¡n ${orderId}`,
        ]
      );
    }

    const paymentId = randomUUID();

    await connection.execute(
      `
      INSERT INTO payments (
        id,
        order_id,
        payment_method,
        amount,
        payment_status,
        paid_at
      )
      VALUES (?, ?, ?, ?, 'paid', NOW())
      `,
      [paymentId, orderId, data.paymentMethod, finalAmount]
    );

    await connection.commit();

    return {
      id: orderId,
      customerId: data.customerId,
      createdBy: data.createdBy,
      status: "completed",
      totalAmount,
      discountAmount,
      finalAmount,
      note: data.note,
      details,
      payment: {
        id: paymentId,
        paymentMethod: data.paymentMethod,
        amount: finalAmount,
        paymentStatus: "paid",
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
