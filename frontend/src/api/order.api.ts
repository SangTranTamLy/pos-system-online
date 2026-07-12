import { apiRequest } from "./api-client";

export type OrderStatus = "completed" | "cancelled" | "refunded";
export type PaymentMethod = "cash" | "qr";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type CancelOrderPayload = {
  reason: string;
};

export type OrderListParams = {
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

function buildQuery(params?: OrderListParams) {
  const searchParams = new URLSearchParams();

  if (params?.status) searchParams.set("status", params.status);
  if (params?.search?.trim()) searchParams.set("search", params.search.trim());
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.createdBy) searchParams.set("createdBy", params.createdBy);
  if (params?.shiftId) searchParams.set("shiftId", params.shiftId);

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function getOrders(params?: OrderListParams) {
  return apiRequest<OrderListItem[]>({
    method: "GET",
    url: `/orders${buildQuery(params)}`,
  });
}

export function getOrderDetail(id: string) {
  return apiRequest<OrderDetail>({ method: "GET", url: `/orders/${id}` });
}

export function cancelOrder(id: string, payload: CancelOrderPayload) {
  return apiRequest<OrderDetail>({
    method: "POST",
    url: `/invoices/${id}/cancel`,
    data: payload,
  });
}
