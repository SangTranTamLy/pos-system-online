import { apiData } from "./api-client";

export type Promotion = {
  id: string;
  promotionScope: "product" | "combo";
  productId: string | null;
  productName: string;
  requiredItems: PromotionRequiredItem[];
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

export type PromotionRequiredItem = {
  productId: string;
  productName: string;
  quantity: number;
};

export type PromotionFormData = {
  promotionScope: "product" | "combo";
  productId: string | null;
  requiredItems: Array<{ productId: string; quantity: number }>;
  code: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startAt: string;
  endAt: string;
  isActive?: boolean;
};

function toPromotionPayload(data: PromotionFormData) {
  return {
    promotionScope: data.promotionScope,
    productId: data.productId,
    requiredItems: data.requiredItems,
    code: data.code,
    name: data.name,
    discountType: data.discountType,
    discountValue: data.discountValue,
    startAt: data.startAt || null,
    endAt: data.endAt || null,
  };
}

export function fetchPromotions(): Promise<Promotion[]> {
  return apiData<Promotion[]>({ method: "GET", url: "/promotions" });
}

export function createPromotion(data: PromotionFormData): Promise<Promotion> {
  return apiData<Promotion>({
    method: "POST",
    url: "/promotions",
    data: toPromotionPayload(data),
  });
}

export function updatePromotion(
  id: string,
  data: PromotionFormData
): Promise<Promotion> {
  return apiData<Promotion>({
    method: "PUT",
    url: `/promotions/${id}`,
    data: {
      ...toPromotionPayload(data),
      isActive: data.isActive,
    },
  });
}

export function togglePromotion(id: string): Promise<Promotion> {
  return apiData<Promotion>({
    method: "PATCH",
    url: `/promotions/${id}/toggle`,
  });
}

export async function deletePromotion(id: string): Promise<void> {
  await apiData<unknown>({ method: "DELETE", url: `/promotions/${id}` });
}
