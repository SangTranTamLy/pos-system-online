const API_BASE_URL = "http://localhost:5000/api";

export type Customer = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  totalSpent: number;
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
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

export async function getCustomer(id: string) {
  const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Customer>(response);
}
