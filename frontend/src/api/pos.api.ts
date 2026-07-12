import { apiRequest } from "./api-client";

export type PosPaymentMethod = "cash" | "qr";

export type CreatePosOrderPayload = {
  customerId?: string | null;
  customerPhone?: string | null;
  paymentMethod: PosPaymentMethod;
  note?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  promotionCode?: string | null;
  changeAmount?: number;
  shiftId?: string | null;
  discountAmount?: number;
};

export type PosOrderDetail = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PosPayment = {
  id: string;
  paymentMethod: PosPaymentMethod;
  amount: number;
  paymentStatus: "paid";
};

export type PosAppliedPromotion = {
  id: string;
  code: string | null;
  name: string;
  ruleType: string;
  discountAmount: number;
};

export type PosOrderResult = {
  id: string;
  customerId: string | null;
  createdBy: string;
  status: "completed";
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  changeAmount: number;
  note: string | null;
  appliedPromotion: PosAppliedPromotion | null;
  details: PosOrderDetail[];
  payment: PosPayment;
  alerts?: { name: string; stockQuantity: number; minStock: number }[];
};

export type ValidatePromotionItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type ValidatedPromotion = {
  code: string;
  name: string;
  productId: string;
  productName: string;
  discountPercent?: number;
  discountFixed?: number;
  discountAmount?: number;
};

export type PosPromotionPreview = {
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  appliedPromotion: PosAppliedPromotion | null;
};

export function createPosOrder(payload: CreatePosOrderPayload) {
  return apiRequest<PosOrderResult>({
    method: "POST",
    url: "/pos/orders",
    data: payload,
  });
}

export function validatePromotionCode(
  code: string,
  items: ValidatePromotionItem[] = []
) {
  return apiRequest<ValidatedPromotion>({
    method: "POST",
    url: "/pos/promotions/validate",
    data: { code, items },
  });
}

export function previewPosPromotion(
  items: ValidatePromotionItem[],
  code?: string | null
) {
  return apiRequest<PosPromotionPreview>({
    method: "POST",
    url: "/pos/promotions/preview",
    data: { code: code || null, items },
  });
}
