import type { Promotion } from "../api/promotions.api";
import type { PosPromotionPreview } from "../api/pos.api";
import type { OfflineCartItem } from "./types";

function getProductQuantity(items: OfflineCartItem[], productId: string | null) {
  if (!productId) return 0;
  return items
    .filter((item) => item.product.id === productId)
    .reduce((total, item) => total + item.quantity, 0);
}

function isPromotionActive(promotion: Promotion, now: number) {
  return (
    promotion.isActive &&
    (!promotion.startAt || new Date(promotion.startAt).getTime() <= now) &&
    (!promotion.endAt || new Date(promotion.endAt).getTime() > now)
  );
}

export function calculateOfflinePromotionPreview(
  cartItems: OfflineCartItem[],
  promotions: Promotion[],
  promotionCode?: string | null
): PosPromotionPreview {
  const subtotal = cartItems.reduce(
    (total, item) => total + item.product.salePrice * item.quantity,
    0
  );
  const normalizedCode = promotionCode?.trim().toUpperCase() ?? "";
  const promotion = promotions.find(
    (item) =>
      item.code.trim().toUpperCase() === normalizedCode &&
      isPromotionActive(item, Date.now())
  );

  if (!normalizedCode || !promotion) {
    return {
      subtotal,
      discountAmount: 0,
      finalAmount: subtotal,
      appliedPromotion: null,
    };
  }

  let eligibleSubtotal = subtotal;
  let comboSets = 1;

  if (promotion.promotionScope === "product") {
    eligibleSubtotal = cartItems
      .filter((item) => item.product.id === promotion.productId)
      .reduce(
        (total, item) => total + item.product.salePrice * item.quantity,
        0
      );
    if (eligibleSubtotal <= 0) {
      throw new Error("Giỏ hàng chưa có sản phẩm áp dụng mã khuyến mãi này.");
    }
  } else {
    const setCounts = promotion.requiredItems.map((item) =>
      Math.floor(getProductQuantity(cartItems, item.productId) / item.quantity)
    );
    comboSets = setCounts.length > 0 ? Math.min(...setCounts) : 0;
    if (comboSets <= 0) {
      throw new Error("Giỏ hàng chưa đủ món để áp dụng mã combo này.");
    }
  }

  const rawDiscount =
    promotion.discountType === "percent"
      ? (eligibleSubtotal * promotion.discountValue) / 100
      : promotion.discountValue * comboSets;
  const discountAmount = Math.round(Math.min(rawDiscount, subtotal));

  return {
    subtotal,
    discountAmount,
    finalAmount: subtotal - discountAmount,
    appliedPromotion: {
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      ruleType:
        promotion.promotionScope === "combo" ? "combo_fixed" : "product_code",
      discountAmount,
    },
  };
}

