export type PosPaymentMethod = "cash" | "qr" | "card";

export type CreatePosOrderItemBody = {
  productId?: string;
  quantity?: number;
};

export type CreatePosOrderBody = {
  customerId?: string | null;
  paymentMethod?: PosPaymentMethod;
  note?: string | null;
  items?: CreatePosOrderItemBody[];
  promotionCode?: string | null;
  pointsUsed?: number;
  changeAmount?: number;
};

export type NormalizedPosOrderItem = {
  productId: string;
  quantity: number;
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

export type PosOrderResult = {
  id: string;
  customerId: string | null;
  createdBy: string;
  status: "completed";
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  pointsEarned: number;
  pointsUsed: number;
  changeAmount: number;
  note: string | null;
  details: PosOrderDetail[];
  payment: PosPayment;
};
