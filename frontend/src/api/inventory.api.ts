const API_BASE_URL = "http://localhost:5000/api";

export type Supplier = {
  id: string;
  name: string;
  contactName?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  debt?: number; // local mock or computed
};

export type Material = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  supplierId?: string | null;
  supplierName?: string | null;
  stockQuantity: number;
  importPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoodsReceiptMaterialDetail = {
  id: string;
  receiptId: string;
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type GoodsReceiptDetail = {
  id: string;
  receiptId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type GoodsReceipt = {
  id: string;
  supplierId: string | null;
  supplierName?: string | null;
  createdBy: string;
  createdByName?: string | null;
  note: string | null;
  totalAmount: number;
  createdAt: string;
  details: GoodsReceiptDetail[];
  materialDetails?: GoodsReceiptMaterialDetail[];
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

export async function fetchSuppliers() {
  const response = await fetch(`${API_BASE_URL}/inventory/suppliers`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse<Supplier[]>(response);
}

export async function createSupplier(payload: {
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/inventory/suppliers`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Supplier>(response);
}

export async function updateSupplier(
  id: string,
  payload: {
    name: string;
    contactName?: string;
    phone: string;
    email?: string;
    address?: string;
  }
) {
  const response = await fetch(`${API_BASE_URL}/inventory/suppliers/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Supplier>(response);
}

export async function deleteSupplier(id: string) {
  const response = await fetch(`${API_BASE_URL}/inventory/suppliers/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<Supplier>(response);
}

export async function fetchMaterials() {
  const response = await fetch(`${API_BASE_URL}/inventory/materials`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse<Material[]>(response);
}

export async function createMaterial(payload: {
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  supplierId?: string | null;
  importPrice?: number;
  isActive?: boolean;
}) {
  const response = await fetch(`${API_BASE_URL}/inventory/materials`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Material>(response);
}

export async function fetchGoodsReceipts() {
  const response = await fetch(`${API_BASE_URL}/inventory/receipts`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse<GoodsReceipt[]>(response);
}

export async function createGoodsReceipt(payload: {
  supplierId: string | null;
  note?: string;
  materialItems?: Array<{
    materialId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount?: number;
  createdAt?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/inventory/receipts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<GoodsReceipt>(response);
}

export async function adjustStock(payload: {
  productId: string;
  newQuantity: number;
  note: string;
}) {
  const response = await fetch(`${API_BASE_URL}/inventory/adjust`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<unknown>(response);
}

export async function updateMaterial(
  id: string,
  payload: {
    name: string;
    sku?: string;
    category?: string;
    unit: string;
    supplierId?: string | null;
    importPrice?: number;
    isActive?: boolean;
  }
) {
  const response = await fetch(`${API_BASE_URL}/inventory/materials/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Material>(response);
}

export async function deleteMaterial(id: string) {
  const response = await fetch(`${API_BASE_URL}/inventory/materials/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<Material>(response);
}
