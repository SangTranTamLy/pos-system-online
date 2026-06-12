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
  findPromotionByCode,
  calculateDiscount,
} from "./promotions.repository";
import {
  findCustomerById,
  updateCustomerAfterOrder,
  recordPointsTransaction,
} from "./customers.repository";

type ProductForSaleRow = RowDataPacket & {
  id: string;
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
  pointsUsed?: number;
  changeAmount?: number;
};

const POINTS_PER_VND = 1 / 10000;

async function findCustomerForUpdate(
  connection: PoolConnection,
  customerId: string
) {
  const [rows] = await connection.execute<RowDataPacket[]>(
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

    let customer = null;
    if (data.customerId) {
      customer = await findCustomerById(connection, data.customerId);

      if (!customer) {
        throw new ApiError(404, "Không tìm thấy khách hàng");
      }
    }

    const orderId = randomUUID();
    const details: PosOrderDetail[] = [];

    for (const item of data.items) {
      const product = await findProductForUpdate(connection, item.productId);

      if (!product) {
        throw new ApiError(404, "Không tìm thấy sản phẩm");
      }

      if (product.status !== "active") {
        throw new ApiError(409, `Sản phẩm "${product.name}" không đang bán`);
      }

      if (product.stock_quantity < item.quantity) {
        throw new ApiError(409, `Sản phẩm "${product.name}" không đủ tồn kho`);
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

    let discountAmount = 0;
    let promotionId: string | null = null;

    if (data.promotionCode) {
      const promotion = await findPromotionByCode(connection, data.promotionCode);

      if (!promotion) {
        throw new ApiError(400, "Mã khuyến mãi không hợp lệ hoặc đã hết hạn");
      }

      promotionId = promotion.id;
      discountAmount = calculateDiscount(totalAmount, promotion);
    }

    // Không cho giảm giá vượt quá tổng tiền
    // (tránh final_amount âm vi phạm CHECK constraint trong MySQL gây lỗi 500)
    discountAmount = Math.min(discountAmount, totalAmount);

    let pointsUsed = data.pointsUsed ?? 0;
    let pointsEarned = 0;
    let finalAmount = totalAmount - discountAmount;

    if (!customer && pointsUsed > 0) {
      throw new ApiError(400, "Cần chọn khách hàng để sử dụng điểm tích lũy");
    }

    if (customer) {
      if (pointsUsed > 0) {
        const maxPointsCanUse = customer.loyalty_points;
        if (pointsUsed > maxPointsCanUse) {
          throw new ApiError(
            400,
            `Khách hàng chỉ có ${maxPointsCanUse} điểm, không thể sử dụng ${pointsUsed} điểm`
          );
        }

        const pointsValue = pointsUsed * 100;
        if (pointsValue > finalAmount) {
          throw new ApiError(400, "Điểm sử dụng không thể vượt quá tổng tiền");
        }

        finalAmount -= pointsValue;
      }

      pointsEarned = Math.floor(finalAmount * POINTS_PER_VND);
    }

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
        points_used,
        points_earned,
        note
      )
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
      `,
      [
        orderId,
        data.customerId,
        data.createdBy,
        promotionId,
        totalAmount,
        discountAmount,
        finalAmount,
        pointsUsed,
        pointsEarned,
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
          `Bán hàng tại quầy - đơn ${orderId}`,
        ]
      );
    }

    if (customer && (pointsEarned > 0 || pointsUsed > 0)) {
      await updateCustomerAfterOrder(
        connection,
        data.customerId!,
        finalAmount,
        pointsEarned,
        pointsUsed
      );

      if (pointsEarned > 0) {
        await recordPointsTransaction(
          connection,
          data.customerId!,
          orderId,
          pointsEarned,
          "earn"
        );
      }

      if (pointsUsed > 0) {
        await recordPointsTransaction(
          connection,
          data.customerId!,
          orderId,
          pointsUsed,
          "redeem"
        );
      }
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
      pointsEarned,
      pointsUsed,
      changeAmount,
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