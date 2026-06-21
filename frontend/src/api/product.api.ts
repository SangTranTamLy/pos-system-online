const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000/api";

export type ProductStatus = "active" | "paused" | "out_of_stock";

export type Product = {
  id: string;
  categoryId: string;
  categoryName?: string;
  requiresPreparation: boolean;
  isStockReturnable: boolean;
  sku: string;
  name: string;
  importPrice: number;
  salePrice: number;
  stockQuantity: number;
  status: ProductStatus;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductPayload = {
  categoryId: string;
  sku: string;
  name: string;
  requiresPreparation?: boolean;
  isStockReturnable?: boolean;
  importPrice?: number;
  salePrice: number;
  stockQuantity?: number;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export type UpdateProductStatusPayload = {
  status: ProductStatus;
};

export type UploadProductImageResult = {
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
    throw new Error(data.message || "Phiên đăng nhập đã hết hạn");
  }

  if (!response.ok) {
    throw new Error(data.message || "Yêu cầu API thất bại");
  }

  return data;
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

export async function getProducts() {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Product[]>(response);
}

export async function getProductDetail(id: string) {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Product>(response);
}

export async function createProduct(payload: CreateProductPayload) {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Product>(response);
}

export async function updateProduct(id: string, payload: UpdateProductPayload) {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Product>(response);
}

export async function updateProductStatus(
  id: string,
  payload: UpdateProductStatusPayload
) {
  const response = await fetch(`${API_BASE_URL}/products/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Product>(response);
}

export async function deleteProduct(id: string) {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return handleResponse<Product>(response);
}

export async function uploadProductImage(file: File) {
  const imageBase64 = await readFileAsDataUrl(file);

  const response = await fetch(`${API_BASE_URL}/products/upload-image`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      imageBase64,
    }),
  });

  return handleResponse<UploadProductImageResult>(response);
}

export type ProductRecipeIngredient = {
  ingredientId: string;
  ingredientName: string;
  quantityNeeded: number;
  unit: string;
};

export type SaveProductRecipePayload = {
  ingredients: Array<{
    ingredientId: string;
    quantityNeeded: number;
  }>;
};

export async function getProductRecipe(productId: string) {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/recipe`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<ProductRecipeIngredient[]>(response);
}

export async function saveProductRecipe(productId: string, payload: SaveProductRecipePayload) {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/recipe`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<{ success: boolean; message: string }>(response);
}
