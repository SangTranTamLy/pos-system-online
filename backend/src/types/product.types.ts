export type ProductStatus = "active" | "paused" | "out_of_stock";

export interface Product {
  id: string;
  categoryId: string;
  categoryName?: string;
  isTrackedStock: boolean;
  isAvailable: boolean;
  sku: string;
  name: string;
  importPrice: number;
  salePrice: number;
  stockQuantity: number | null;
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
  isTrackedStock?: boolean;
  isAvailable?: boolean;
  importPrice?: number;
  salePrice: number;
  stockQuantity?: number | null;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
}

export interface UpdateProductBody {
  categoryId?: string;
  sku?: string;
  name?: string;
  isTrackedStock?: boolean;
  isAvailable?: boolean;
  importPrice?: number;
  salePrice?: number;
  stockQuantity?: number | null;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
}

export interface UploadProductImageBody {
  fileName?: string;
  imageBase64?: string;
}
