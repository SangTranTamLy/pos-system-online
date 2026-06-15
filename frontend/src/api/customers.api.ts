const API_BASE_URL = "http://localhost:5000/api";

export type Customer = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  orderCount: number;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type CustomerPayload = {
  fullName: string;
  phone: string;
  email?: string | null;
};

export type CustomerPointTransaction = {
  id: string;
  customerId: string;
  orderId: string | null;
  points: number;
  transactionType: "earn" | "redeem" | "adjust";
  note: string | null;
  createdAt: string;
};

export type CustomerOrderSummary = {
  id: string;
  status: string;
  finalAmount: number;
  paymentMethod: string | null;
  createdAt: string;
};

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");

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

export async function getCustomers(query = "") {
  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
  });

  if (query.trim()) {
    params.set("q", query.trim());
  }

  const response = await fetch(`${API_BASE_URL}/customers?${params.toString()}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Customer[]>(response);
}

export async function searchCustomers(query: string) {
  const response = await fetch(
    `${API_BASE_URL}/customers/search?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  return handleResponse<Customer[]>(response);
}

export async function createCustomer(payload: CustomerPayload) {
  const response = await fetch(`${API_BASE_URL}/customers`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Customer>(response);
}

export async function getCustomer(id: string) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Customer>(response);
}

export async function updateCustomer(id: string, payload: CustomerPayload) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Customer>(response);
}

export async function deleteCustomer(id: string) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return handleResponse<Customer>(response);
}

export async function getCustomerPoints(id: string) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}/points`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<CustomerPointTransaction[]>(response);
}

export async function getCustomerOrders(id: string) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}/orders`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<CustomerOrderSummary[]>(response);
}
