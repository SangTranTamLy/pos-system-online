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
import {
  calculateBestPosPromotion,
} from "./promotions.repository";
import {
  findCustomerById,
  updateCustomerAfterOrder,
} from "./customers.repository";

type ProductForSaleRow = RowDataPacket & {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  sale_price: string;
  stock_quantity: number;
  status: "active" | "paused" | "out_of_stock";
};

type CreatePosOrderTransactionData = {
  customerId: string | null;
  createdBy: string;
  paymentMethod: PosPaymentMethod;
  note: string | null;
  items: NormalizedPosOrderItem[];
  promotionCode?: string | null;
  changeAmount?: number;
};

async function findProductForUpdate(
  connection: PoolConnection,
  productId: string
) {
  const [rows] = await connection.execute<ProductForSaleRow[]>(
    `
    SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.sale_price,
      products.stock_quantity,
      products.status
    FROM products
    JOIN categories ON categories.id = products.category_id
    WHERE products.id = ?
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

    let customer = null;
    if (data.customerId) {
      customer = await findCustomerById(connection, data.customerId);

      if (!customer) {
        throw new ApiError(404, "Khong tim thay khach hang");
      }
    }

    const orderId = randomUUID();
    const details: PosOrderDetail[] = [];

    for (const item of data.items) {
      const product = await findProductForUpdate(connection, item.productId);

      if (!product) {
        throw new ApiError(404, "Khong tim thay san pham");
      }

      if (product.status !== "active") {
        throw new ApiError(409, `San pham "${product.name}" khong dang ban`);
      }

      if (product.stock_quantity < item.quantity) {
        throw new ApiError(409, `San pham "${product.name}" khong du ton kho`);
      }

      const unitPrice = Number(product.sale_price);
      const lineTotal = unitPrice * item.quantity;

      details.push({
        id: randomUUID(),
        productId: product.id,
        productName: product.name,
        categoryId: product.category_id,
        categoryName: product.category_name,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    const totalAmount = details.reduce(
      (total, detail) => total + detail.lineTotal,
      0
    );

    let discountAmount = 0;
    let promotionId: string | null = null;
    const appliedPromotion = await calculateBestPosPromotion(
      connection,
      details,
      totalAmount,
      data.promotionCode
    );

    if (data.promotionCode && !appliedPromotion) {
      throw new ApiError(400, "Ma khuyen mai khong hop le hoac khong phu hop don hang");
    }

    if (appliedPromotion) {
      discountAmount = appliedPromotion.discountAmount;
      promotionId =
        appliedPromotion.ruleType === "product_code" ? appliedPromotion.id : null;
    }

    discountAmount = Math.min(discountAmount, totalAmount);
    const finalAmount = totalAmount - discountAmount;

    await connection.execute(
      `
      INSERT INTO orders (
        id,
        customer_id,
        created_by,
        promotion_id,
        status,
        total_amount,
        discount_amount,
        final_amount,
        note
      )
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `,
      [
        orderId,
        data.customerId,
        data.createdBy,
        promotionId,
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
          `Ban hang tai quay - don ${orderId}`,
        ]
      );
    }

    if (customer) {
      await updateCustomerAfterOrder(connection, data.customerId!, finalAmount);
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

    const changeAmount = data.changeAmount ?? 0;

    return {
      id: orderId,
      customerId: data.customerId,
      createdBy: data.createdBy,
      status: "completed",
      totalAmount,
      discountAmount,
      finalAmount,
      changeAmount,
      note: data.note,
      appliedPromotion: appliedPromotion
        ? {
            id: appliedPromotion.id,
            code: appliedPromotion.code,
            name: appliedPromotion.name,
            ruleType: appliedPromotion.ruleType,
            discountAmount,
          }
        : null,
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
