export type OrderStatus = "completed" | "cancelled" | "refunded";
export type PaymentMethod = "cash" | "qr";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type CancelOrderBody = {
  reason?: string;
};

export type OrderListQuery = {
  status?: OrderStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  createdBy?: string;
  shiftId?: string;
};

export type OrderListItem = {
  id: string;
  customerId: string | null;
  customerName: string;
  createdBy: string | null;
  createdByName: string | null;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderDetailItem = {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  modifierOptions: Array<{ id: string; name: string; priceDelta: number }>;
  itemNote: string | null;
  configurationSnapshot: Record<string, unknown> | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderPayment = {
  id: string;
  paymentMethod: PaymentMethod;
  amount: number;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
};

export type OrderDetail = OrderListItem & {
  promotionId: string | null;
  note: string | null;
  details: OrderDetailItem[];
  payments: OrderPayment[];
};
