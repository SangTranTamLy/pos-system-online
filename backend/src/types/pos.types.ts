export type PosPaymentMethod = "cash" | "qr";

export type CreatePosOrderItemBody = {
  productId?: string;
  variantId?: string | null;
  modifierOptionIds?: string[];
  quantity?: number;
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
};

export type NormalizedPosOrderItem = {
  productId: string;
  variantId: string | null;
  modifierOptionIds: string[];
  quantity: number;
  note: string | null;
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
  alerts?: { name: string; stockQuantity: number; minStock: number }[];
};
