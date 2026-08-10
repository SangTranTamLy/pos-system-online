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
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type OrderDetailRow = OrderListRow & {
  promotion_id: string | null;
  note: string | null;
};

type OrderItemRow = RowDataPacket & {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  variant_id: string | null;
  variant_name: string | null;
  item_note: string | null;
  configuration_snapshot: Record<string, unknown> | string | null;
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
  customer_id: string | null;
  shift_id: string | null;
  final_amount: string;
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
    cancelReason: row.cancel_reason,
    createdAt: toIsoString(row.created_at) || "",
    updatedAt: toIsoString(row.updated_at) || "",
  };
}

function mapOrderDetail(row: OrderDetailRow): Omit<OrderDetail, "details" | "payments"> {
  return {
    ...mapOrderListItem(row),
    promotionId: row.promotion_id,
    note: row.note,
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
    variantId: row.variant_id,
    variantName: row.variant_name,
    itemNote: row.item_note,
    configurationSnapshot:
      typeof row.configuration_snapshot === "string"
        ? JSON.parse(row.configuration_snapshot)
        : row.configuration_snapshot,
    modifierOptions: (() => {
      const snapshot =
        typeof row.configuration_snapshot === "string"
          ? JSON.parse(row.configuration_snapshot)
          : row.configuration_snapshot;
      return Array.isArray(snapshot?.modifiers) ? snapshot.modifiers : [];
    })(),
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

  if (query.createdBy) {
    conditions.push("o.created_by = ?");
    params.push(query.createdBy);
  }

  if (query.shiftId) {
    conditions.push("o.shift_id = ?");
    params.push(query.shiftId);
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

function isLegacyPaymentSchemaError(error: unknown) {
  const code = (error as { code?: string }).code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
}

export async function findOrders(query: OrderListQuery): Promise<OrderListItem[]> {
  const { whereClause, params } = buildOrderFilters(query);
  let rows: OrderListRow[];

  try {
    [rows] = await db.execute<OrderListRow[]>(
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
      o.cancel_reason,
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
  } catch (error) {
    if (!isLegacyPaymentSchemaError(error)) {
      throw error;
    }

    [rows] = await db.execute<OrderListRow[]>(
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
        NULL AS payment_method,
        NULL AS payment_status,
        o.cancel_reason,
        o.created_at,
        o.updated_at
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users u ON u.id = o.created_by
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT 200
      `,
      params
    );
  }

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

      NULL AS note,

      p.payment_method,
      p.payment_status,
      o.cancel_reason,
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
      od.variant_id,
      pv.name AS variant_name,
      od.quantity,
      od.unit_price,
      od.line_total,
      od.item_note,
      od.configuration_snapshot
    FROM order_details od
    JOIN products p ON p.id = od.product_id
    LEFT JOIN product_variants pv ON pv.id = od.variant_id
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
    SELECT id, status, customer_id, shift_id, final_amount
    FROM orders
    WHERE id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [orderId]
  );

  return rows[0] ?? null;
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
      WHERE order_id = ? AND payment_status = 'paid'
      `,
      [orderId]
    );

    if (order.customer_id) {
      await connection.execute(
        `UPDATE customers c
         SET total_spent = (
               SELECT COALESCE(SUM(o.final_amount), 0)
               FROM orders o
               WHERE o.customer_id = c.id AND o.status = 'completed'
             ),
             order_count = (
               SELECT COUNT(*)
               FROM orders o
               WHERE o.customer_id = c.id AND o.status = 'completed'
             ),
             last_order_at = (
               SELECT MAX(o.created_at)
               FROM orders o
               WHERE o.customer_id = c.id AND o.status = 'completed'
             )
         WHERE c.id = ?`,
        [order.customer_id]
      );
    }

    if (order.shift_id) {
      await connection.execute(
        `UPDATE shifts s
         LEFT JOIN (
           SELECT
             o.shift_id,
             COALESCE(SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END), 0) AS cash_total,
             COALESCE(SUM(CASE WHEN p.payment_method = 'qr' THEN p.amount ELSE 0 END), 0) AS qr_total,
             COALESCE(SUM(p.amount), 0) AS paid_total
           FROM orders o
           JOIN payments p ON p.order_id = o.id
           WHERE o.shift_id = ?
             AND o.status = 'completed'
             AND p.payment_status = 'paid'
           GROUP BY o.shift_id
         ) totals ON totals.shift_id = s.id
         SET s.total_sales_cash = COALESCE(totals.cash_total, 0),
             s.total_sales_qr = COALESCE(totals.qr_total, 0),
             s.total_sales = COALESCE(totals.paid_total, 0),
             s.variance = CASE
               WHEN s.status = 'CLOSED'
                 THEN s.actual_closing_cash - s.opening_cash - COALESCE(totals.cash_total, 0)
               ELSE s.variance
             END
         WHERE s.id = ?`,
        [order.shift_id, order.shift_id]
      );
    }

    const [userRows] = await connection.execute<RowDataPacket[]>(
      `SELECT u.full_name, r.name AS role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? 
       LIMIT 1`,
      [cancelledBy]
    );
    const userFullName = userRows[0]?.full_name || "Nhân viên";
    const rawRole = userRows[0]?.role_name || "staff";
    const userRole = rawRole.trim().toLowerCase() === "admin" || rawRole.trim().toLowerCase() === "manager" ? "QL" : "TN";

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
      VALUES (?, ?, ?, ?, 'HUY_HOA_DON', ?, ?)
      `,
      [
        randomUUID(),
        cancelledBy,
        userFullName,
        userRole,
        `Đơn #${orderId}`,
        `Hủy hóa đơn. Lý do: ${cancelReason}.`
      ]
    );

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
      VALUES (?, ?, ?, ?, 'HOAN_TIEN', ?, ?)
      `,
      [
        randomUUID(),
        cancelledBy,
        userFullName,
        userRole,
        `Đơn #${orderId}`,
        `Hoàn tiền hóa đơn ${Number(order.final_amount).toLocaleString("vi-VN")}đ. Lý do: ${cancelReason}.`
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
