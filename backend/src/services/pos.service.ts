import { createPosOrderTransaction } from "../repositories/pos.repository";
import type {
  CreatePosOrderBody,
  NormalizedPosOrderItem,
  PosPaymentMethod,
} from "../types/pos.types";
import { ApiError } from "../utils/apiError";

const allowedPaymentMethods: PosPaymentMethod[] = ["cash", "qr", "card"];

function normalizeItems(items: CreatePosOrderBody["items"]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Vui lÃ²ng chá»n sáº£n pháº©m cáº§n bÃ¡n");
  }

  const itemMap = new Map<string, number>();

  for (const item of items) {
    const productId = item.productId?.trim();
    const quantity = Number(item.quantity);

    if (!productId) {
      throw new ApiError(400, "Thiáº¿u sáº£n pháº©m trong Ä‘Æ¡n hÃ ng");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, "Sá»‘ lÆ°á»£ng sáº£n pháº©m khÃ´ng há»£p lá»‡");
    }

    itemMap.set(productId, (itemMap.get(productId) ?? 0) + quantity);
  }

  return Array.from(itemMap.entries()).map<NormalizedPosOrderItem>(
    ([productId, quantity]) => ({
      productId,
      quantity,
    })
  );
}

export async function createPosOrderService(
  body: CreatePosOrderBody,
  createdBy: string
) {
  const paymentMethod = body.paymentMethod ?? "cash";

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    throw new ApiError(400, "PhÆ°Æ¡ng thá»©c thanh toÃ¡n khÃ´ng há»£p lá»‡");
  }

  const items = normalizeItems(body.items);

  return createPosOrderTransaction({
    customerId: body.customerId?.trim() || null,
    createdBy,
    paymentMethod,
    note: body.note?.trim() || null,
    items,
  });
}
