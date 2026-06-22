export type PosPaymentMethod = "cash" | "qr" | "card";

export type CreatePosOrderItemBody = {
  productId?: string;
  quantity?: number;
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
  quantity: number;
};

export type PosOrderDetail = {
  id: string;
  productId: string;
  productName: string;
  categoryId?: string | null;
  categoryName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isTrackedStock?: boolean;
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
