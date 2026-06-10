import { randomUUID } from "crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type {
  OrderDetail,
  OrderDetailItem,
  OrderListItem,
  OrderListQuery,
  OrderPayment,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../types/order.types";

type OrderListRow = RowDataPacket & {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  status: OrderStatus;
  total_amount: string;
  discount_amount: string;
  final_amount: string;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus | null;
  created_at: Date;
  updated_at: Date;
};

type OrderDetailRow = OrderListRow & {
  promotion_id: string | null;
  note: string | null;
  points_used: number;
  points_earned: number;
};

type OrderItemRow = RowDataPacket & {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
};

type PaymentRow = RowDataPacket & {
  id: string;
  payment_method: PaymentMethod;
  amount: string;
  payment_status: PaymentStatus;
  paid_at: Date | null;
};

type OrderStatusRow = RowDataPacket & {
  id: string;
  status: OrderStatus;
};

type CancelOrderItemRow = RowDataPacket & {
  product_id: string;
  product_name: string;
  quantity: number;
  requires_preparation: boolean | number | string;
  is_stock_returnable: boolean | number | string;
};

function mapOrderListItem(row: OrderListRow): OrderListItem {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name || "Khách lẻ",
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    status: row.status,
    totalAmount: Number(row.total_amount),
    discountAmount: Number(row.discount_amount),
    finalAmount: Number(row.final_amount),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    createdAt: toIsoString(row.created_at) || "",
    updatedAt: toIsoString(row.updated_at) || "",
  };
}

function mapOrderDetail(row: OrderDetailRow): Omit<OrderDetail, "details" | "payments"> {
  return {
    ...mapOrderListItem(row),
    promotionId: row.promotion_id,
    note: row.note,
    pointsUsed: row.points_used,
    pointsEarned: row.points_earned,
  };
}

function mapOrderItem(row: OrderItemRow): OrderDetailItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  };
}

function mapPayment(row: PaymentRow): OrderPayment {
  return {
    id: row.id,
    paymentMethod: row.payment_method,
    amount: Number(row.amount),
    paymentStatus: row.payment_status,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  };
}
function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function buildOrderFilters(query: OrderListQuery) {
  const conditions: string[] = [];
  const params: string[] = [];

  if (query.status) {
    conditions.push("o.status = ?");
    params.push(query.status);
  }

  if (query.dateFrom) {
    conditions.push("DATE(o.created_at) >= ?");
    params.push(query.dateFrom);
  }

  if (query.dateTo) {
    conditions.push("DATE(o.created_at) <= ?");
    params.push(query.dateTo);
  }

  if (query.search) {
    conditions.push("(o.id LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR u.full_name LIKE ?)");
    const searchValue = `%${query.search}%`;
    params.push(searchValue, searchValue, searchValue, searchValue);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

const latestPaymentJoin = `
  LEFT JOIN (
    SELECT
      order_id,
      SUBSTRING_INDEX(GROUP_CONCAT(payment_method ORDER BY paid_at DESC, id DESC), ',', 1) AS payment_method,
      SUBSTRING_INDEX(GROUP_CONCAT(payment_status ORDER BY paid_at DESC, id DESC), ',', 1) AS payment_status
    FROM payments
    GROUP BY order_id
  ) p ON p.order_id = o.id
`;

export async function findOrders(query: OrderListQuery): Promise<OrderListItem[]> {
  const { whereClause, params } = buildOrderFilters(query);
  const [rows] = await db.execute<OrderListRow[]>(
    `
    SELECT
      o.id,
      o.customer_id,
      COALESCE(c.full_name, 'Khách lẻ') AS customer_name,
      o.created_by,
      u.full_name AS created_by_name,
      o.status,
      o.total_amount,
      o.discount_amount,
      o.final_amount,
      p.payment_method,
      p.payment_status,
      o.created_at,
      o.updated_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users u ON u.id = o.created_by
    ${latestPaymentJoin}
    ${whereClause}
    ORDER BY o.created_at DESC
    LIMIT 200
    `,
    params
  );

  return rows.map(mapOrderListItem);
}

export async function findOrderById(
  id: string
): Promise<Omit<OrderDetail, "details" | "payments"> | null> {
  const [rows] = await db.execute<OrderDetailRow[]>(
    `
    SELECT
      o.id,
      o.customer_id,
      COALESCE(c.full_name, 'Khách lẻ') AS customer_name,
      o.created_by,
      COALESCE(u.full_name, 'Không rõ') AS created_by_name,

      NULL AS promotion_id,

      o.status,
      o.total_amount,
      o.discount_amount,
      o.final_amount,

      0 AS points_used,
      0 AS points_earned,
      NULL AS note,

      p.payment_method,
      p.payment_status,
      o.created_at,
      o.updated_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users u ON u.id = o.created_by
    ${latestPaymentJoin}
    WHERE o.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ? mapOrderDetail(rows[0]) : null;
}

export async function findOrderDetailsByOrderId(orderId: string): Promise<OrderDetailItem[]> {
  const [rows] = await db.execute<OrderItemRow[]>(
    `
    SELECT
      od.id,
      od.product_id,
      p.name AS product_name,
      od.quantity,
      od.unit_price,
      od.line_total
    FROM order_details od
    JOIN products p ON p.id = od.product_id
    WHERE od.order_id = ?
    ORDER BY p.name ASC
    `,
    [orderId]
  );

  return rows.map(mapOrderItem);
}

export async function findPaymentsByOrderId(orderId: string): Promise<OrderPayment[]> {
  const [rows] = await db.execute<PaymentRow[]>(
    `
    SELECT
      id,
      payment_method,
      amount,
      payment_status,
      paid_at
    FROM payments
    WHERE order_id = ?
    ORDER BY paid_at DESC, id DESC
    `,
    [orderId]
  );

  return rows.map(mapPayment);
}

async function findOrderStatusForUpdate(connection: PoolConnection, orderId: string) {
  const [rows] = await connection.execute<OrderStatusRow[]>(
    `
    SELECT id, status
    FROM orders
    WHERE id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [orderId]
  );

  return rows[0] ?? null;
}

async function findOrderItemsForCancel(connection: PoolConnection, orderId: string) {
  const [rows] = await connection.execute<CancelOrderItemRow[]>(
    `
    SELECT
      od.product_id,
      p.name AS product_name,
      od.quantity,
      p.requires_preparation,
      COALESCE(p.is_stock_returnable, 0) AS is_stock_returnable
    FROM order_details od
    JOIN products p ON p.id = od.product_id
    WHERE od.order_id = ?
    `,
    [orderId]
  );

  return rows;
}

function toBooleanFlag(value: boolean | number | string) {
  return value === true || value === 1 || value === "1";
}

function shouldRestoreStock(item: CancelOrderItemRow) {
  // Chỉ hàng có sẵn/đóng chai/lon được đánh dấu rõ ràng mới hoàn kho.
  return toBooleanFlag(item.is_stock_returnable);
}

export async function cancelOrderById(
  orderId: string,
  cancelledBy: string,
  cancelReason: string
): Promise<OrderDetail | null> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const order = await findOrderStatusForUpdate(connection, orderId);

    if (!order) {
      await connection.rollback();
      return null;
    }

    if (order.status !== "completed") {
      await connection.rollback();
      return null;
    }

    const items = await findOrderItemsForCancel(connection, orderId);
    const restoredItems: Array<{ productId: string; productName: string; quantity: number }> = [];
    const wasteItems: Array<{ productId: string; productName: string; quantity: number }> = [];

    for (const item of items) {
      if (!shouldRestoreStock(item)) {
        await connection.execute(
          `
          INSERT INTO waste_transactions (
            id,
            order_id,
            product_id,
            created_by,
            quantity,
            reason
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [randomUUID(), orderId, item.product_id, cancelledBy, item.quantity, cancelReason]
        );

        wasteItems.push({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
        });

        continue;
      }

      await connection.execute(
        `
        UPDATE products
        SET
          stock_quantity = stock_quantity + ?,
          status = CASE
            WHEN status = 'out_of_stock' THEN 'active'
            ELSE status
          END
        WHERE id = ?
        `,
        [item.quantity, item.product_id]
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
        VALUES (?, ?, ?, 'import', ?, ?)
        `,
        [
          randomUUID(),
          item.product_id,
          cancelledBy,
          item.quantity,
          `Hoàn kho khi hủy hóa đơn ${orderId}. Lý do: ${cancelReason}`,
        ]
      );

      restoredItems.push({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
      });
    }

    await connection.execute(
      `
      UPDATE orders
      SET
        status = 'cancelled',
        cancelled_by = ?,
        cancelled_at = NOW(),
        cancel_reason = ?
      WHERE id = ?
      `,
      [cancelledBy, cancelReason, orderId]
    );

    await connection.execute(
      `
      UPDATE payments
      SET payment_status = 'refunded'
      WHERE order_id = ?
      `,
      [orderId]
    );

    await connection.execute(
      `
      INSERT INTO audit_logs (
        id,
        user_id,
        action,
        entity_name,
        entity_id,
        metadata
      )
      VALUES (?, ?, 'cancel_invoice', 'orders', ?, ?)
      `,
      [
        randomUUID(),
        cancelledBy,
        orderId,
        JSON.stringify({
          reason: cancelReason,
          restoredItems,
          wasteItems,
        }),
      ]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const cancelledOrder = await findOrderById(orderId);

  if (!cancelledOrder) {
    return null;
  }

  const [details, payments] = await Promise.all([
    findOrderDetailsByOrderId(orderId),
    findPaymentsByOrderId(orderId),
  ]);

  return {
    ...cancelledOrder,
    details,
    payments,
  };
}
