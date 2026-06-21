export type ProductStatus = "active" | "paused" | "out_of_stock";

export interface Product {
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
}

export interface CreateProductBody {
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
}

export interface UpdateProductBody {
  categoryId?: string;
  sku?: string;
  name?: string;
  requiresPreparation?: boolean;
  isStockReturnable?: boolean;
  importPrice?: number;
  salePrice?: number;
  stockQuantity?: number;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
}

export interface UploadProductImageBody {
  fileName?: string;
  imageBase64?: string;
}

export interface SaveProductRecipeIngredient {
  ingredientId: string;
  quantityNeeded: number;
}

export interface SaveProductRecipeBody {
  ingredients: SaveProductRecipeIngredient[];
}

export interface ProductRecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantityNeeded: number;
  unit: string;
}
