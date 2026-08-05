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
  PosPaymentMethod,
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

    if (!productId) {
      throw new ApiError(400, "Thiáº¿u sáº£n pháº©m trong Ä‘Æ¡n hĂ ng");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, "Sá»‘ lÆ°á»£ng sáº£n pháº©m khĂ´ng há»£p lá»‡");
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
    });
  }

  return Array.from(itemMap.values());
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
  let shiftId: string | null = null;

  if (!allowNoShift) {
    const { db } = await import("../config/database");
    const [shifts] = await db.execute<any[]>(
      "SELECT id, opening_cash FROM shifts WHERE user_id = ? AND status = 'OPEN' LIMIT 1",
      [createdBy]
    );
    shiftId = shifts[0]?.id || null;

    if (!shiftId) {
      throw new ApiError(409, "B?n c?n m? ca làm tru?c khi bán hàng.");
    }

    if (Number(shifts[0]?.opening_cash || 0) <= 0) {
      throw new ApiError(409, "B?n c?n nh?p ti?n d?u ca tru?c khi bán hàng.");
    }
  }

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
  });
}
