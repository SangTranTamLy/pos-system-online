import { findCustomerByPhone } from "../repositories/customers.repository";
import { createRequiredAuditLog } from "../repositories/audit-log.repository";
import {
  createPosOrderTransaction,
  findProductsForCartCancellation,
} from "../repositories/pos.repository";
import { findUserById } from "../repositories/user.repository";
import { findProductConfiguration } from "../repositories/product-configuration.repository";
import type {
  CreateCartCancellationBody,
  CreatePosOrderBody,
  NormalizedPosOrderItem,
  PosOrderSyncResult,
  PosPaymentMethod,
  PosSyncMetadata,
} from "../types/pos.types";
import { ApiError } from "../utils/apiError";

const allowedPaymentMethods: PosPaymentMethod[] = ["cash", "qr"];

export async function getPosProductConfigurationService(productId: string) {
  const configuration = await findProductConfiguration(productId);
  if (!configuration) {
    throw new ApiError(404, "Không tìm thấy sản phẩm.");
  }
  return {
    ...configuration,
    variants: configuration.variants
      .filter((item) => item.isActive)
      .map((item) => ({ ...item, recipeItems: [] })),
    modifierOptions: (configuration.productType === "combo" ? [] : configuration.modifierOptions)
      .filter((item) => item.isActive)
      .map((item) => ({ ...item, recipeItems: [] })),
  };
}

export async function createCartCancellationService(
  body: CreateCartCancellationBody,
  userId: string
) {
  const scope = body.scope;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (scope !== "item" && scope !== "cart") {
    throw new ApiError(400, "Phạm vi hủy món không hợp lệ");
  }
  if (reason.length < 3 || reason.length > 500) {
    throw new ApiError(400, "Lý do hủy món phải có từ 3 đến 500 ký tự");
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw new ApiError(400, "Danh sách món cần hủy không hợp lệ");
  }

  const quantities = new Map<string, number>();
  for (const item of body.items) {
    const productId = item.productId?.trim();
    const quantity = Number(item.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, "Sản phẩm hoặc số lượng hủy không hợp lệ");
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  const products = await findProductsForCartCancellation([...quantities.keys()]);
  if (products.length !== quantities.size) {
    throw new ApiError(404, "Có sản phẩm cần hủy không tồn tại");
  }

  const cancelledItems = products.map((product) => ({
    productId: product.id,
    productName: product.name,
    quantity: quantities.get(product.id) ?? 0,
  }));
  const itemSummary = cancelledItems
    .map((item) => `${item.productName} x${item.quantity}`)
    .join(", ");

  await createRequiredAuditLog(
    userId,
    "HUY_MON",
    scope === "cart" ? "Giỏ hàng POS" : `Món: ${cancelledItems[0].productName}`,
    `Hủy ${scope === "cart" ? "toàn bộ giỏ hàng" : "món trong giỏ"}. Lý do: ${reason}. Chi tiết: ${itemSummary}.`,
    { items: cancelledItems },
    { scope, reason }
  );

  return { scope, reason, items: cancelledItems };
}

function canSellWithoutShift(roleName?: string) {
  const role = (roleName || "").trim().toLowerCase();
  return (
    role === "admin" ||
    role === "manager" ||
    role === "quáº£n lĂ½" ||
    role === "quáº£n trá»‹ viĂªn"
  );
}

function normalizeItems(items: CreatePosOrderBody["items"]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Vui lĂ²ng chá»n sáº£n pháº©m cáº§n bĂ¡n");
  }

  const itemMap = new Map<string, NormalizedPosOrderItem>();

  for (const item of items) {
    const productId = item.productId?.trim();
    const variantId = item.variantId?.trim() || null;
    const modifierOptionIds = Array.from(
      new Set(
        (Array.isArray(item.modifierOptionIds) ? item.modifierOptionIds : [])
          .map((id) => String(id).trim())
          .filter(Boolean)
      )
    ).sort();
    const note = item.note?.trim() || null;
    const quantity = Number(item.quantity);
    const unitPrice = item.unitPrice == null ? null : Number(item.unitPrice);

    if (!productId) {
      throw new ApiError(400, "Thiáº¿u sáº£n pháº©m trong Ä‘Æ¡n hĂ ng");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, "Sá»‘ lÆ°á»£ng sáº£n pháº©m khĂ´ng há»£p lá»‡");
    }

    if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      throw new ApiError(400, "Giá bán lưu trên máy POS không hợp lệ.");
    }

    if (note && note.length > 500) {
      throw new ApiError(400, "Ghi chú món không được vượt quá 500 ký tự.");
    }

    const key = JSON.stringify([productId, variantId, modifierOptionIds, note]);
    const current = itemMap.get(key);
    itemMap.set(key, {
      productId,
      variantId,
      modifierOptionIds,
      note,
      quantity: (current?.quantity ?? 0) + quantity,
      unitPrice: current?.unitPrice ?? unitPrice,
    });
  }

  return Array.from(itemMap.values());
}

function normalizeRequiredSyncId(
  value: unknown,
  label: string,
  maxLength = 120
) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new ApiError(400, `${label} không hợp lệ.`);
  }
  return normalized;
}

function normalizeExpectedMoney(value: unknown, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, `${label} không hợp lệ.`);
  }
  return amount;
}

function normalizeSyncMetadata(body: CreatePosOrderBody): PosSyncMetadata {
  const clientCreatedAt = new Date(body.clientCreatedAt ?? "");
  if (
    Number.isNaN(clientCreatedAt.getTime()) ||
    clientCreatedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    throw new ApiError(400, "Thời điểm tạo đơn offline không hợp lệ.");
  }

  const expectedTotalAmount = normalizeExpectedMoney(
    body.totalAmount,
    "Tạm tính trên máy POS"
  );
  const expectedDiscountAmount = normalizeExpectedMoney(
    body.discountAmount,
    "Giảm giá trên máy POS"
  );
  const expectedFinalAmount = normalizeExpectedMoney(
    body.finalAmount,
    "Tổng thanh toán trên máy POS"
  );

  if (
    Math.abs(
      expectedTotalAmount - expectedDiscountAmount - expectedFinalAmount
    ) > 0.01
  ) {
    throw new ApiError(400, "Các tổng tiền của đơn offline không khớp nhau.");
  }

  return {
    operationId: normalizeRequiredSyncId(body.operationId, "operationId", 80),
    terminalId: normalizeRequiredSyncId(body.terminalId, "terminalId", 80),
    localOrderId: normalizeRequiredSyncId(
      body.localOrderId,
      "localOrderId",
      160
    ),
    clientCreatedAt,
    expectedTotalAmount,
    expectedDiscountAmount,
    expectedFinalAmount,
  };
}

async function resolveShiftId(
  body: CreatePosOrderBody,
  createdBy: string,
  allowNoShift: boolean,
  isOfflineSync: boolean
) {
  if (allowNoShift) return null;

  const { db } = await import("../config/database");
  const requestedShiftId = body.shiftId?.trim() || null;
  const [shifts] = requestedShiftId && isOfflineSync
    ? await db.execute<any[]>(
        `SELECT id, opening_cash, status, user_id
         FROM shifts WHERE id = ? LIMIT 1`,
        [requestedShiftId]
      )
    : await db.execute<any[]>(
        `SELECT id, opening_cash, status, user_id
         FROM shifts
         WHERE user_id = ? AND status = 'OPEN'
         LIMIT 1`,
        [createdBy]
      );
  const shift = shifts[0];

  if (!shift || shift.status !== "OPEN") {
    throw new ApiError(409, "Ca làm đã đóng hoặc không còn khả dụng.");
  }
  if (shift.user_id !== createdBy) {
    throw new ApiError(403, "Ca làm không thuộc nhân viên đang bán hàng.");
  }
  if (Number(shift.opening_cash || 0) <= 0) {
    throw new ApiError(409, "Bạn cần nhập tiền đầu ca trước khi bán hàng.");
  }

  return String(shift.id);
}

export async function createPosOrderService(
  body: CreatePosOrderBody,
  createdBy: string
) {
  const paymentMethod = body.paymentMethod ?? "cash";

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    throw new ApiError(400, "PhÆ°Æ¡ng thá»©c thanh toĂ¡n khĂ´ng há»£p lá»‡");
  }

  const items = normalizeItems(body.items);
  let customerId = body.customerId?.trim() || null;
  const customerPhone = body.customerPhone?.replace(/\s+/g, "").trim();

  if (!customerId && customerPhone) {
    const customer = await findCustomerByPhone(customerPhone);
    customerId = customer?.id ?? null;
  }

  const user = await findUserById(createdBy);
  const allowNoShift = canSellWithoutShift(user?.roleName);
  const shiftId = await resolveShiftId(body, createdBy, allowNoShift, false);

  return createPosOrderTransaction({
    customerId,
    createdBy,
    paymentMethod,
    note: body.note?.trim() || null,
    items,
    promotionCode: body.promotionCode?.trim() || null,
    changeAmount: body.changeAmount ?? 0,
    discountAmount: Number(body.discountAmount) || 0,
    shiftId,
    sync: null,
  });
}

export async function createPosOrderSyncService(
  body: CreatePosOrderBody,
  createdBy: string
): Promise<PosOrderSyncResult> {
  if ((body.paymentMethod ?? "cash") !== "cash") {
    throw new ApiError(400, "MVP offline chỉ đồng bộ đơn thanh toán tiền mặt.");
  }

  const sync = normalizeSyncMetadata(body);
  const items = normalizeItems(body.items);
  if (items.some((item) => item.unitPrice == null)) {
    throw new ApiError(400, "Đơn offline thiếu giá bán snapshot của sản phẩm.");
  }

  let customerId = body.customerId?.trim() || null;
  const customerPhone = body.customerPhone?.replace(/\s+/g, "").trim();
  if (!customerId && customerPhone) {
    const customer = await findCustomerByPhone(customerPhone);
    customerId = customer?.id ?? null;
  }

  const user = await findUserById(createdBy);
  const allowNoShift = canSellWithoutShift(user?.roleName);
  const shiftId = allowNoShift ? null : body.shiftId?.trim() || null;
  if (!allowNoShift && !shiftId) {
    throw new ApiError(409, "Đơn offline không có thông tin ca làm việc.");
  }
  const order = await createPosOrderTransaction({
    customerId,
    createdBy,
    paymentMethod: "cash",
    note: body.note?.trim() || null,
    items,
    promotionCode: body.promotionCode?.trim() || null,
    changeAmount: body.changeAmount ?? 0,
    discountAmount: sync.expectedDiscountAmount,
    shiftId,
    sync,
  });

  return {
    status:
      order.syncStatus === "ALREADY_SYNCED" ? "ALREADY_SYNCED" : "SYNCED",
    operationId: sync.operationId,
    localOrderId: sync.localOrderId,
    order,
  };
}
