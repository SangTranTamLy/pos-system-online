import { randomUUID } from "crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { db } from "../config/database";
import type {
  NormalizedPosOrderItem,
  PosOrderDetail,
  PosOrderResult,
  PosPaymentMethod,
  PosSyncMetadata,
} from "../types/pos.types";
import { ApiError } from "../utils/apiError";
import {
  calculateBestPosPromotion,
  getPromotionCodeFailureMessage,
} from "./promotions.repository";
import { findCustomerById, updateCustomerAfterOrder } from "./customers.repository";

export async function findProductsForCartCancellation(productIds: string[]) {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map(() => "?").join(", ");
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, name FROM products WHERE id IN (${placeholders})`,
    productIds
  );
  return rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}

type ProductRow = RowDataPacket & {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  status: "active" | "paused";
  is_available: number;
  product_type: "single" | "combo";
};
type VariantRow = RowDataPacket & {
  id: string;
  product_id: string;
  name: string;
  sale_price: string;
  is_active: number;
  is_default: number;
};
type ComboComponentRow = {
  product: Pick<ProductRow, "id" | "category_id" | "category_name" | "name" | "status" | "is_available" | "product_type">;
  variant: Pick<VariantRow, "id" | "product_id" | "name" | "sale_price" | "is_active" | "is_default">;
  quantity: number;
};
type ModifierRow = RowDataPacket & {
  id: string;
  name: string;
  price_delta: string;
  is_active: number;
};
type OpenShiftRow = RowDataPacket & {
  id: string;
  status: string;
  user_id: string;
  opening_cash: string;
};
type SyncOperationRow = RowDataPacket & {
  operation_id: string;
  terminal_id: string;
  local_order_id: string;
  server_order_id: string | null;
  status: "PROCESSING" | "SYNCED" | "REJECTED" | "CONFLICT_STOCK";
  response_payload: unknown;
};

type PreparedLine = {
  input: NormalizedPosOrderItem;
  product: ProductRow;
  variant: VariantRow;
  modifiers: ModifierRow[];
  comboComponents: ComboComponentRow[];
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
  sync: PosSyncMetadata | null;
};

function isSameMoney(left: number, right: number) {
  return Math.abs(left - right) <= 0.01;
}

function parseJsonPayload(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getSyncFailureStatus(error: ApiError) {
  const normalized = error.message.toLocaleLowerCase("vi-VN");
  return normalized.includes("tồn kho") || normalized.includes("stock")
    ? "CONFLICT_STOCK"
    : "REJECTED";
}

async function persistRejectedSyncOperation(
  sync: PosSyncMetadata,
  error: ApiError
) {
  const status = getSyncFailureStatus(error);
  await db.execute(
    `INSERT IGNORE INTO pos_sync_operations
      (operation_id, terminal_id, local_order_id, server_order_id, status,
       response_payload)
     VALUES (?, ?, ?, NULL, ?, ?)`,
    [
      sync.operationId,
      sync.terminalId,
      sync.localOrderId,
      status,
      JSON.stringify({ status, message: error.message }),
    ]
  );
}

async function loadProduct(connection: PoolConnection, productId: string) {
  const [rows] = await connection.execute<ProductRow[]>(
    `SELECT p.id, p.category_id, c.name AS category_name, p.name,
            p.status, p.is_available, p.product_type
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? LIMIT 1`,
    [productId]
  );
  return rows[0] ?? null;
}

async function loadVariant(
  connection: PoolConnection,
  productId: string,
  variantId: string | null
) {
  const params = variantId ? [productId, variantId] : [productId];
  const [rows] = await connection.execute<VariantRow[]>(
    variantId
      ? `SELECT id, product_id, name, sale_price, is_active, is_default
         FROM product_variants WHERE product_id = ? AND id = ? LIMIT 1`
      : `SELECT id, product_id, name, sale_price, is_active, is_default
         FROM product_variants
         WHERE product_id = ? AND is_default = 1 LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

async function loadComboComponents(connection: PoolConnection, comboProductId: string) {
  const [rows] = await connection.execute<
    (RowDataPacket & ProductRow & { variant_id: string; variant_name: string; variant_sale_price: string; variant_is_active: number; variant_is_default: number; quantity: number })[]
  >(
    `SELECT p.id, p.category_id, c.name AS category_name, p.name, p.status,
            p.is_available, p.product_type,
            pv.id AS variant_id, pv.name AS variant_name, pv.sale_price AS variant_sale_price,
            pv.is_active AS variant_is_active, pv.is_default AS variant_is_default,
            ci.quantity
     FROM combo_items ci
     JOIN products p ON p.id = ci.component_product_id
     JOIN categories c ON c.id = p.category_id
     JOIN product_variants pv ON pv.id = ci.component_variant_id AND pv.product_id = p.id
     WHERE ci.combo_product_id = ?
     ORDER BY ci.id`,
    [comboProductId]
  );
  return rows.map<ComboComponentRow>((row) => ({
    product: {
      id: row.id, category_id: row.category_id, category_name: row.category_name,
      name: row.name, status: row.status, is_available: row.is_available,
      product_type: row.product_type,
    },
    variant: {
      id: row.variant_id, product_id: row.id, name: row.variant_name,
      sale_price: row.variant_sale_price, is_active: row.variant_is_active,
      is_default: row.variant_is_default,
    },
    quantity: Number(row.quantity),
  }));
}

async function loadModifiers(
  connection: PoolConnection,
  productId: string,
  ids: string[]
) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await connection.execute<ModifierRow[]>(
    `SELECT mo.id, mo.name, mo.price_delta, mo.is_active
     FROM product_modifier_options pmo
     JOIN modifier_options mo ON mo.id = pmo.modifier_option_id
     WHERE pmo.product_id = ? AND mo.id IN (${placeholders})`,
    [productId, ...ids]
  );
  if (rows.length !== ids.length) {
    throw new ApiError(400, "Có topping không được phép áp dụng cho món đã chọn.");
  }
  if (rows.some((row) => !row.is_active)) {
    throw new ApiError(409, "Có topping đã ngừng phục vụ.");
  }
  return rows;
}

async function prepareLine(
  connection: PoolConnection,
  input: NormalizedPosOrderItem
): Promise<PreparedLine> {
  const product = await loadProduct(connection, input.productId);
  if (!product) throw new ApiError(404, "Không tìm thấy sản phẩm.");
  const variant = await loadVariant(connection, product.id, input.variantId);
  if (!variant || !variant.is_active) {
    throw new ApiError(409, `Biến thể của "${product.name}" không còn khả dụng.`);
  }
  const modifiers = await loadModifiers(
    connection,
    product.id,
    input.modifierOptionIds
  );
  let comboComponents: ComboComponentRow[] = [];
  if (product.product_type === "combo") {
    if (!variant.is_default) {
      throw new ApiError(400, "Combo phải sử dụng biến thể mặc định đã cấu hình.");
    }
    if (input.modifierOptionIds.length > 0) {
      throw new ApiError(400, "Combo cố định không hỗ trợ topping.");
    }
    comboComponents = await loadComboComponents(connection, product.id);
    if (!comboComponents.length) {
      throw new ApiError(409, `Combo "${product.name}" chưa có món thành phần.`);
    }
    for (const component of comboComponents) {
      if (!component.product.is_available || component.product.status !== "active" || !component.variant.is_active) {
        throw new ApiError(409, `Món thành phần của combo "${product.name}" hiện không bán.`);
      }
    }
  }

  return { input, product, variant, modifiers, comboComponents };
}

async function lockOpenShift(
  connection: PoolConnection,
  shiftId: string,
  employeeId: string
) {
  const [rows] = await connection.execute<OpenShiftRow[]>(
    `SELECT id, status, user_id, opening_cash
     FROM shifts WHERE id = ? LIMIT 1 FOR UPDATE`,
    [shiftId]
  );
  const shift = rows[0];
  if (!shift || shift.status !== "OPEN") {
    throw new ApiError(409, "Ca làm đã đóng hoặc không còn khả dụng.");
  }
  if (shift.user_id !== employeeId) {
    throw new ApiError(403, "Ca làm không thuộc nhân viên đang bán hàng.");
  }
  if (Number(shift.opening_cash || 0) <= 0) {
    throw new ApiError(409, "Ca làm chưa có tiền đầu ca.");
  }
}

export async function createPosOrderTransaction(
  data: CreatePosOrderTransactionData
): Promise<PosOrderResult> {
  const connection = await db.getConnection();
  let ownsSyncOperation = false;
  try {
    await connection.beginTransaction();

    if (data.sync) {
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO pos_sync_operations
          (operation_id, terminal_id, local_order_id, status)
         VALUES (?, ?, ?, 'PROCESSING')`,
        [
          data.sync.operationId,
          data.sync.terminalId,
          data.sync.localOrderId,
        ]
      );
      ownsSyncOperation = insertResult.affectedRows === 1;

      const [operationRows] = await connection.execute<SyncOperationRow[]>(
        `SELECT operation_id, terminal_id, local_order_id, server_order_id,
                status, response_payload
         FROM pos_sync_operations
         WHERE operation_id = ?
         LIMIT 1 FOR UPDATE`,
        [data.sync.operationId]
      );
      const operation = operationRows[0];

      if (!operation) {
        throw new ApiError(
          409,
          "localOrderId đã được ghi nhận với một operationId khác."
        );
      }
      if (
        operation.terminal_id !== data.sync.terminalId ||
        operation.local_order_id !== data.sync.localOrderId
      ) {
        throw new ApiError(
          409,
          "operationId đã được dùng cho một đơn hoặc terminal khác."
        );
      }

      if (!ownsSyncOperation) {
        const payload = parseJsonPayload(operation.response_payload);
        if (operation.status === "SYNCED") {
          const storedOrder = payload?.order ?? payload;
          if (!storedOrder || typeof storedOrder !== "object") {
            throw new ApiError(500, "Kết quả đồng bộ cũ không đọc được.");
          }
          await connection.commit();
          return {
            ...(storedOrder as PosOrderResult),
            syncStatus: "ALREADY_SYNCED",
            operationId: data.sync.operationId,
            localOrderId: data.sync.localOrderId,
          };
        }
        if (
          operation.status === "REJECTED" ||
          operation.status === "CONFLICT_STOCK"
        ) {
          throw new ApiError(
            409,
            typeof payload?.message === "string"
              ? payload.message
              : "Đơn offline đã bị từ chối trước đó."
          );
        }
        throw new ApiError(409, "Đơn offline đang được một tiến trình khác xử lý.");
      }
    }

    if (data.shiftId) await lockOpenShift(connection, data.shiftId, data.createdBy);

    const customer = data.customerId
      ? await findCustomerById(connection, data.customerId)
      : null;
    if (data.customerId && !customer) {
      throw new ApiError(404, "Không tìm thấy khách hàng.");
    }

    const prepared: PreparedLine[] = [];
    for (const item of data.items) prepared.push(await prepareLine(connection, item));

    const productIds = Array.from(
      new Set(prepared.flatMap((line) => [
        line.product.id,
        ...line.comboComponents.map((component) => component.product.id),
      ]))
    ).sort();
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      const [lockedProducts] = await connection.execute<ProductRow[]>(
        `SELECT p.id, p.category_id, c.name AS category_name, p.name,
                p.status, p.is_available, p.product_type
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.id IN (${placeholders}) ORDER BY p.id FOR UPDATE`,
        productIds
      );
      const byId = new Map(lockedProducts.map((item) => [item.id, item]));
      for (const line of prepared) {
        for (const product of [line.product, ...line.comboComponents.map((component) => component.product)]) {
          const live = byId.get(product.id);
        if (!live?.is_available || live.status !== "active") {
          throw new ApiError(409, `Sản phẩm "${line.product.name}" hiện không bán.`);
        }
        }
      }
    }

    const variantIds = Array.from(
      new Set(prepared.flatMap((line) => [
        line.variant.id,
        ...line.comboComponents.map((component) => component.variant.id),
      ]))
    ).sort();
    if (variantIds.length) {
      const placeholders = variantIds.map(() => "?").join(",");
      await connection.execute(
        `SELECT id FROM product_variants
         WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
        variantIds
      );
    }

    const modifierIds = Array.from(
      new Set(prepared.flatMap((line) => line.modifiers.map((item) => item.id)))
    ).sort();
    if (modifierIds.length) {
      const placeholders = modifierIds.map(() => "?").join(",");
      await connection.execute(
        `SELECT id FROM modifier_options
         WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
        modifierIds
      );
    }

    const orderId = randomUUID();
    const details: PosOrderDetail[] = prepared.map((line) => {
      const unitPrice =
        Number(line.variant.sale_price) +
        line.modifiers.reduce((sum, item) => sum + Number(item.price_delta), 0);
      if (
        data.sync &&
        line.input.unitPrice != null &&
        !isSameMoney(line.input.unitPrice, unitPrice)
      ) {
        throw new ApiError(
          409,
          `Giá của "${line.product.name}" đã thay đổi từ ${line.input.unitPrice} thành ${unitPrice}. Đơn offline được giữ lại để kiểm tra.`
        );
      }
      const snapshot = {
        variant: {
          id: line.variant.id,
          name: line.variant.name,
          salePrice: Number(line.variant.sale_price),
        },
        modifiers: line.modifiers.map((item) => ({
          id: item.id,
          name: item.name,
          priceDelta: Number(item.price_delta),
        })),
        note: line.input.note,
        comboComponents: line.comboComponents.map((component) => ({
          productId: component.product.id,
          productName: component.product.name,
          variantId: component.variant.id,
          variantName: component.variant.name,
          quantity: component.quantity,
        })),
      };
      return {
        id: randomUUID(),
        productId: line.product.id,
        productName: line.product.name,
        categoryId: line.product.category_id,
        categoryName: line.product.category_name,
        variantId: line.variant.id,
        variantName: line.variant.name,
        modifierOptions: snapshot.modifiers,
        itemNote: line.input.note,
        configurationSnapshot: snapshot,
        quantity: line.input.quantity,
        unitPrice,
        lineTotal: unitPrice * line.input.quantity,
      };
    });
    const totalAmount = details.reduce((sum, item) => sum + item.lineTotal, 0);
    const appliedPromotion = await calculateBestPosPromotion(
      connection,
      details,
      totalAmount,
      data.promotionCode
    );
    if (data.promotionCode && !appliedPromotion) {
      throw new ApiError(
        400,
        (await getPromotionCodeFailureMessage(
          connection,
          details,
          data.promotionCode
        )) ?? "Mã khuyến mãi không hợp lệ."
      );
    }
    const discountAmount = Math.min(
      appliedPromotion?.discountAmount ?? 0,
      totalAmount
    );
    const finalAmount = totalAmount - discountAmount;
    const promotionId =
      appliedPromotion?.ruleType === "product_code" ? appliedPromotion.id : null;

    if (
      data.sync &&
      (!isSameMoney(totalAmount, data.sync.expectedTotalAmount) ||
        !isSameMoney(discountAmount, data.sync.expectedDiscountAmount) ||
        !isSameMoney(finalAmount, data.sync.expectedFinalAmount))
    ) {
      throw new ApiError(
        409,
        "Giá hoặc khuyến mãi hiện tại khác với số tiền khách đã thanh toán. Đơn offline được giữ lại để kiểm tra."
      );
    }

    await connection.execute(
      `INSERT INTO orders
        (id, customer_id, shift_id, created_by, promotion_id, status,
         total_amount, discount_amount, final_amount, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, COALESCE(?, NOW()),
               COALESCE(?, NOW()))`,
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
        data.sync?.clientCreatedAt ?? null,
        data.sync?.clientCreatedAt ?? null,
      ]
    );

    for (let index = 0; index < details.length; index += 1) {
      const detail = details[index];
      await connection.execute(
        `INSERT INTO order_details
          (id, order_id, product_id, variant_id, quantity, unit_price,
           line_total, item_note, configuration_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          detail.id,
          orderId,
          detail.productId,
          detail.variantId ?? null,
          detail.quantity,
          detail.unitPrice,
          detail.lineTotal,
          detail.itemNote ?? null,
          JSON.stringify(detail.configurationSnapshot ?? {}),
        ]
      );
    }

    if (customer) {
      await updateCustomerAfterOrder(connection, data.customerId!, finalAmount);
    }
    const paymentId = randomUUID();
    await connection.execute(
      `INSERT INTO payments
        (id, order_id, payment_method, amount, payment_status, paid_at)
       VALUES (?, ?, ?, ?, 'paid', COALESCE(?, NOW()))`,
      [
        paymentId,
        orderId,
        data.paymentMethod,
        finalAmount,
        data.sync?.clientCreatedAt ?? null,
      ]
    );
    await connection.execute(
      `INSERT INTO audit_logs
        (id, user_id, action_type, target_object, description)
       VALUES (?, ?, 'BAN_HANG', ?, ?)`,
      [
        randomUUID(),
        data.createdBy,
        `Đơn #${orderId}`,
        `Thanh toán đơn hàng ${finalAmount.toLocaleString("vi-VN")}đ.`,
      ]
    );
    const result: PosOrderResult = {
      id: orderId,
      customerId: data.customerId,
      createdBy: data.createdBy,
      status: "completed",
      totalAmount,
      discountAmount,
      finalAmount,
      changeAmount: data.changeAmount ?? 0,
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
      syncStatus: data.sync ? "SYNCED" : undefined,
      operationId: data.sync?.operationId,
      localOrderId: data.sync?.localOrderId,
      createdAt: (data.sync?.clientCreatedAt ?? new Date()).toISOString(),
    };

    if (data.sync) {
      await connection.execute(
        `UPDATE pos_sync_operations
         SET server_order_id = ?, status = 'SYNCED', response_payload = ?
         WHERE operation_id = ?`,
        [
          orderId,
          JSON.stringify({ order: result }),
          data.sync.operationId,
        ]
      );
    }

    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("POS transaction rollback failed:", rollbackError);
    }

    if (
      data.sync &&
      ownsSyncOperation &&
      error instanceof ApiError &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      try {
        await persistRejectedSyncOperation(data.sync, error);
      } catch (persistError) {
        console.error("Could not persist rejected POS sync operation:", persistError);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}
