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
  stock_quantity: number | null;
  status: "active" | "paused" | "out_of_stock";
  is_tracked_stock: number;
  is_available: number;
};

type CreatePosOrderTransactionData = {
  customerId: string | null;
  createdBy: string;
  paymentMethod: PosPaymentMethod;
  note: string | null;
  items: NormalizedPosOrderItem[];
  promotionCode?: string | null;
  changeAmount?: number;
  discountAmount?: number;
  shiftId: string | null;
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
      products.status,
      products.is_tracked_stock,
      products.is_available
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
        throw new ApiError(404, "Không tìm thấy khách hàng.");
      }
    }

    const orderId = randomUUID();
    const details: PosOrderDetail[] = [];
    const alertsList: { name: string; stockQuantity: number; minStock: number }[] = [];

    for (const item of data.items) {
      const product = await findProductForUpdate(connection, item.productId);

      if (!product) {
        throw new ApiError(404, "Không tìm thấy sản phẩm.");
      }

      if (!product.is_available) {
        throw new ApiError(409, `Sản phẩm "${product.name}" hiện không bán hoặc hết hàng.`);
      }

      // Chỉ kiểm tra tồn kho nếu sản phẩm là nước đóng lon/chai cần quản lý tồn kho (is_tracked_stock = 1)
      if (product.is_tracked_stock && (product.stock_quantity === null || product.stock_quantity < item.quantity)) {
        throw new ApiError(409, `Sản phẩm "${product.name}" không đủ tồn kho.`);
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
        isTrackedStock: Boolean(product.is_tracked_stock),
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
      throw new ApiError(400, "Mã khuyến mãi không hợp lệ hoặc không phù hợp với đơn hàng.");
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
        shift_id,
        created_by,
        promotion_id,
        status,
        total_amount,
        discount_amount,
        final_amount,
        note
      )
      VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `,
      [
        orderId,
        data.customerId,
        data.shiftId,
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

      // Chỉ cập nhật tồn kho và tạo transaction xuất kho sản phẩm khi cần quản lý tồn kho (isTrackedStock = true)
      if (detail.isTrackedStock) {
        await connection.execute(
          `
          UPDATE products
          SET
            stock_quantity = stock_quantity - ?,
            is_available = CASE
              WHEN stock_quantity - ? <= 0 THEN 0
              ELSE is_available
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

    // Thêm nhật ký hoạt động bán hàng / giảm giá
    try {
      const [userRows] = await connection.execute<RowDataPacket[]>(
        `SELECT u.full_name, r.name AS role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ? 
         LIMIT 1`,
        [data.createdBy]
      );
      const userFullName = userRows[0]?.full_name || "Nhân viên";
      const rawRole = userRows[0]?.role_name || "staff";
      const userRole = rawRole.trim().toLowerCase() === "admin" || rawRole.trim().toLowerCase() === "manager" ? "QL" : "TN";

      const actionType = discountAmount > 0 ? "GIAM_GIA" : "BAN_HANG";
      const description = discountAmount > 0
        ? `Thanh toán thành công đơn hàng. Tổng tiền gốc: ${totalAmount.toLocaleString("vi-VN")}đ, Giảm giá: ${discountAmount.toLocaleString("vi-VN")}đ${data.promotionCode ? ` (Mã: ${data.promotionCode})` : ""}, Thực thu: ${finalAmount.toLocaleString("vi-VN")}đ.`
        : `Thanh toán thành công đơn hàng. Tổng tiền: ${finalAmount.toLocaleString("vi-VN")}đ.`;

      await connection.execute(
        `
        INSERT INTO audit_logs (
          id,
          user_id,
          user_name,
          role,
          action_type,
          target_object,
          description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          randomUUID(),
          data.createdBy,
          userFullName,
          userRole,
          actionType,
          `Đơn #${orderId}`,
          description
        ]
      );
    } catch (logErr) {
      console.error("Lỗi ghi log hoạt động bán hàng:", logErr);
    }

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
      alerts: alertsList,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
