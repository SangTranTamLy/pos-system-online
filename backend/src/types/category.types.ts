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

export type CreateCategoryBody = {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  requiresPreparation?: boolean;
  isStockReturnable?: boolean;
};

export type UpdateCategoryBody = {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  requiresPreparation?: boolean;
  isStockReturnable?: boolean;
};

export type UpdateCategoryStatusBody = {
  isActive?: boolean;
};

export type UploadCategoryImageBody = {
  fileName?: string;
  imageBase64?: string;
};
