export type PosPaymentMethod = "cash" | "qr";

export type CreatePosOrderItemBody = {
  productId?: string;
  variantId?: string | null;
  modifierOptionIds?: string[];
  quantity?: number;
  unitPrice?: number;
  note?: string | null;
};

export type CreatePosOrderBody = {
  customerId?: string | null;
  customerPhone?: string | null;
  paymentMethod?: PosPaymentMethod;
  note?: string | null;
  items?: CreatePosOrderItemBody[];
  promotionCode?: string | null;
  changeAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  finalAmount?: number;
  shiftId?: string | null;
  operationId?: string;
  terminalId?: string;
  localOrderId?: string;
  clientCreatedAt?: string;
};

export type NormalizedPosOrderItem = {
  productId: string;
  variantId: string | null;
  modifierOptionIds: string[];
  quantity: number;
  unitPrice: number | null;
  note: string | null;
};

export type PosOrderSyncStatus =
  | "SYNCED"
  | "ALREADY_SYNCED"
  | "REJECTED"
  | "CONFLICT_STOCK";

export type PosSyncMetadata = {
  operationId: string;
  terminalId: string;
  localOrderId: string;
  clientCreatedAt: Date;
  expectedTotalAmount: number;
  expectedDiscountAmount: number;
  expectedFinalAmount: number;
};

export type CartCancellationScope = "item" | "cart";

export type CartCancellationItemBody = {
  productId?: string;
  quantity?: number;
};

export type CreateCartCancellationBody = {
  scope?: CartCancellationScope;
  reason?: string;
  items?: CartCancellationItemBody[];
};

export type PosOrderDetail = {
  id: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  modifierOptions?: Array<{ id: string; name: string; priceDelta: number }>;
  itemNote?: string | null;
  configurationSnapshot?: Record<string, unknown>;
  categoryId?: string | null;
  categoryName?: string | null;
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
  operationId?: string;
  localOrderId?: string;
  createdAt?: string;
};

export type PosOrderSyncResult = {
  status: PosOrderSyncStatus;
  operationId: string;
  localOrderId: string;
  order: PosOrderResult;
};
