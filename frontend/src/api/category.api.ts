const API_BASE_URL = "http://localhost:5000/api";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  isActive: boolean;
  requiresPreparation: boolean;
  isStockReturnable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryPayload = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  requiresPreparation?: boolean;
  isStockReturnable?: boolean;
};

export type UpdateCategoryPayload = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  requiresPreparation?: boolean;
  isStockReturnable?: boolean;
};

export type UpdateCategoryStatusPayload = {
  isActive: boolean;
};

export type UploadCategoryImageResult = {
  imageUrl: string;
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
    throw new Error(data.message || "Yêu cầu API thất bại");
  }

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

export async function updateCategory(id: string, payload: UpdateCategoryPayload) {
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

export async function deleteCategory(id: string) {
  const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return handleResponse<Category>(response);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Không đọc được file ảnh"));
    };

    reader.onerror = () => {
      reject(new Error("Không đọc được file ảnh"));
    };

    reader.readAsDataURL(file);
  });
}

export async function uploadCategoryImage(file: File) {
  const imageBase64 = await readFileAsDataUrl(file);

  const response = await fetch(`${API_BASE_URL}/categories/upload-image`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      imageBase64,
    }),
  });

  return handleResponse<UploadCategoryImageResult>(response);
}

