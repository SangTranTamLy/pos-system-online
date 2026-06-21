const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000/api";

export type PosPaymentMethod = "cash" | "qr" | "card";

export type CreatePosOrderPayload = {
  customerId?: string | null;
  customerPhone?: string | null;
  paymentMethod: PosPaymentMethod;
  note?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  promotionCode?: string | null;
  changeAmount?: number;
  shiftId?: string | null;
  discountAmount?: number;
};

export type PosOrderDetail = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PosPayment = {
  id: string;
  paymentMethod: PosPaymentMethod;
  amount: number;
  paymentStatus: "paid";
};

export type PosAppliedPromotion = {
  id: string;
  code: string | null;
  name: string;
  ruleType: string;
  discountAmount: number;
};

export type PosOrderResult = {
  id: string;
  customerId: string | null;
  createdBy: string;
  status: "completed";
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  changeAmount: number;
  note: string | null;
  appliedPromotion: PosAppliedPromotion | null;
  details: PosOrderDetail[];
  payment: PosPayment;
  alerts?: { name: string; stockQuantity: number; minStock: number }[];
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

export async function createPosOrder(payload: CreatePosOrderPayload) {
  const response = await fetch(`${API_BASE_URL}/pos/orders`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<PosOrderResult>(response);
}

export type ValidatePromotionItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type ValidatedPromotion = {
  code: string;
  name: string;
  productId: string;
  productName: string;
  discountPercent?: number;
  discountFixed?: number;
  discountAmount?: number;
};

export type PosPromotionPreview = {
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  appliedPromotion: PosAppliedPromotion | null;
};

export async function validatePromotionCode(
  code: string,
  items: ValidatePromotionItem[] = []
) {
  const response = await fetch(`${API_BASE_URL}/pos/promotions/validate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ code, items }),
  });

  return handleResponse<ValidatedPromotion>(response);
}

export async function previewPosPromotion(
  items: ValidatePromotionItem[],
  code?: string | null
) {
  const response = await fetch(`${API_BASE_URL}/pos/promotions/preview`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ code: code || null, items }),
  });

  return handleResponse<PosPromotionPreview>(response);
}
