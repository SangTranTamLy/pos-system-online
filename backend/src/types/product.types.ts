export type ProductStatus = "active" | "paused";
export type ProductType = "single" | "combo";

export interface Product {
  id: string;
  categoryId: string;
  categoryName?: string;
  isAvailable: boolean;
  productType: ProductType;
  sku: string;
  name: string;
  importPrice: number;
  salePrice: number;
  status: ProductStatus;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductBody {
  categoryId: string;
  sku: string;
  name: string;
  isAvailable?: boolean;
  importPrice?: number;
  salePrice: number;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
}

export interface UpdateProductBody {
  categoryId?: string;
  sku?: string;
  name?: string;
  isAvailable?: boolean;
  importPrice?: number;
  salePrice?: number;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
}

export interface UploadProductImageBody {
  fileName?: string;
  imageBase64?: string;
}
