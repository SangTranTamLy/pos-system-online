import { API_BASE_URL } from "./api-base";
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    const message =
      (json as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return (json as { data: T }).data;
}

export type Promotion = {
  id: string;
  productId: string;
  productName: string;
  code: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromotionFormData = {
  productId: string;
  code: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startAt: string;
  endAt: string;
  isActive?: boolean;
};

export async function fetchPromotions(): Promise<Promotion[]> {
  const res = await fetch(`${API_BASE_URL}/promotions`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Promotion[]>(res);
}

export async function createPromotion(
  data: PromotionFormData
): Promise<Promotion> {
  const res = await fetch(`${API_BASE_URL}/promotions`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      productId: data.productId,
      code: data.code,
      name: data.name,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startAt: data.startAt || null,
      endAt: data.endAt || null,
    }),
  });
  return handleResponse<Promotion>(res);
}

export async function updatePromotion(
  id: string,
  data: PromotionFormData
): Promise<Promotion> {
  const res = await fetch(`${API_BASE_URL}/promotions/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      productId: data.productId,
      code: data.code,
      name: data.name,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startAt: data.startAt || null,
      endAt: data.endAt || null,
      isActive: data.isActive,
    }),
  });
  return handleResponse<Promotion>(res);
}

export async function togglePromotion(id: string): Promise<Promotion> {
  const res = await fetch(`${API_BASE_URL}/promotions/${id}/toggle`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse<Promotion>(res);
}

export async function deletePromotion(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/promotions/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const json = (await res.json()) as { message?: string };
    throw new Error(json.message ?? `HTTP ${res.status}`);
  }
}
