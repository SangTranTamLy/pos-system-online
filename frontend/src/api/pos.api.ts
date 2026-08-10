import { apiRequest } from "./api-client";
import { API_BASE_URL } from "./api-base";

export type PosPaymentMethod = "cash" | "qr";

export type CreatePosOrderPayload = {
  customerId?: string | null;
  customerPhone?: string | null;
  paymentMethod: PosPaymentMethod;
  note?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    modifierOptionIds?: string[];
    quantity: number;
    note?: string | null;
  }>;
  promotionCode?: string | null;
  changeAmount?: number;
  shiftId?: string | null;
  discountAmount?: number;
};

export type PosOrderSyncStatus =
  | "SYNCED"
  | "ALREADY_SYNCED"
  | "REJECTED"
  | "CONFLICT_STOCK";

export type SyncPosOrderPayload = Omit<
  CreatePosOrderPayload,
  "items" | "paymentMethod"
> & {
  operationId: string;
  terminalId: string;
  localOrderId: string;
  clientCreatedAt: string;
  paymentMethod: "cash";
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  items: Array<{
    productId: string;
    variantId?: string | null;
    modifierOptionIds?: string[];
    quantity: number;
    unitPrice: number;
    note?: string | null;
  }>;
};

export type CreateCartCancellationPayload = {
  scope: "item" | "cart";
  reason: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type PosOrderDetail = {
  id: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  modifierOptions?: Array<{ id: string; name: string; priceDelta: number }>;
  comboComponents?: Array<{
    productId: string;
    productName: string;
    variantId: string;
    variantName: string;
    quantity: number;
  }>;
  itemNote?: string | null;
  configurationSnapshot?: Record<string, unknown>;
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
  syncStatus?: "PENDING" | PosOrderSyncStatus;
  localOrderId?: string;
  operationId?: string;
  createdAt?: string;
};

export type PosOrderSyncResponse = {
  status: PosOrderSyncStatus;
  operationId: string;
  localOrderId: string;
  order: PosOrderResult;
};

export class PosSyncRequestError extends Error {
  statusCode: number | null;
  syncStatus: PosOrderSyncStatus | null;
  isRetryable: boolean;

  constructor(
    message: string,
    statusCode: number | null,
    syncStatus: PosOrderSyncStatus | null
  ) {
    super(message);
    this.name = "PosSyncRequestError";
    this.statusCode = statusCode;
    this.syncStatus = syncStatus;
    this.isRetryable =
      statusCode == null ||
      statusCode === 401 ||
      statusCode === 408 ||
      statusCode === 429 ||
      statusCode >= 500;
  }
}

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

export async function syncPosOrder(payload: SyncPosOrderPayload) {
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("auth_token");

  try {
    const response = await fetch(`${API_BASE_URL}/pos/orders/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          message?: string;
          data?: PosOrderSyncResponse | { status?: PosOrderSyncStatus };
        }
      | null;

    if (!response.ok) {
      const status = body?.data?.status ?? null;
      throw new PosSyncRequestError(
        body?.message || "Đơn offline chưa đồng bộ được.",
        response.status,
        status
      );
    }

    if (!body?.data || !("order" in body.data)) {
      throw new PosSyncRequestError(
        "Phản hồi đồng bộ đơn hàng không hợp lệ.",
        response.status,
        null
      );
    }

    return body.data;
  } catch (error) {
    if (error instanceof PosSyncRequestError) throw error;
    throw new PosSyncRequestError(
      error instanceof Error ? error.message : "Không kết nối được API đồng bộ.",
      null,
      null
    );
  }
}

export function createCartCancellation(payload: CreateCartCancellationPayload) {
  return apiRequest<{
    scope: "item" | "cart";
    reason: string;
    items: Array<{ productId: string; productName: string; quantity: number }>;
  }>({
    method: "POST",
    url: "/pos/cart-cancellations",
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
