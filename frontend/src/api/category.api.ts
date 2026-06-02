const API_BASE_URL = "http://localhost:5000/api";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryPayload = {
  name: string;
  description?: string | null;
};

export type UpdateCategoryPayload = {
  name: string;
  description?: string | null;
};

export type UpdateCategoryStatusPayload = {
  isActive: boolean;
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
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Yêu cầu API thất bại");
  }

  return data;
}

export async function getCategories() {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Category[]>(response);
}

export async function createCategory(payload: CreateCategoryPayload) {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Category>(response);
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload
) {
  const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Category>(response);
}

export async function updateCategoryStatus(
  id: string,
  payload: UpdateCategoryStatusPayload
) {
  const response = await fetch(`${API_BASE_URL}/categories/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Category>(response);
}