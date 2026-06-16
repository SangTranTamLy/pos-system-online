const API_BASE_URL = "http://localhost:5000/api";

export type OrderStatus = "completed" | "cancelled" | "refunded";
export type PaymentMethod = "cash" | "qr" | "card";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type CancelOrderPayload = {
  reason: string;
};

export type OrderListParams = {
  status?: OrderStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
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

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

function getAuthToken() {
  return localStorage.getItem("auth_token");
}

function getAuthHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

function logoutAndRedirect() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");

  if (!window.location.pathname.includes("/login")) {
    window.location.href = `${import.meta.env.BASE_URL}login`;
  }
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json();

  if (response.status === 401) {
    logoutAndRedirect();
    throw new Error(data.message || "Phiên đăng nhập đã hết hạn");
  }

  if (!response.ok) {
    throw new Error(data.message || "Yêu cầu API thất bại");
  }

  return data;
}

function buildQuery(params?: OrderListParams) {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  if (params?.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  if (params?.dateFrom) {
    searchParams.set("dateFrom", params.dateFrom);
  }

  if (params?.dateTo) {
    searchParams.set("dateTo", params.dateTo);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getOrders(params?: OrderListParams) {
  const response = await fetch(`${API_BASE_URL}/orders${buildQuery(params)}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<OrderListItem[]>(response);
}

export async function getOrderDetail(id: string) {
  const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<OrderDetail>(response);
}

export async function cancelOrder(id: string, payload: CancelOrderPayload) {
  const response = await fetch(`${API_BASE_URL}/invoices/${id}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<OrderDetail>(response);
}
