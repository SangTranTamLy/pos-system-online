import { apiRequest } from "./api-client";

export type ProductStatus = "active" | "paused" | "out_of_stock";
export type ProductType = "single" | "combo";

export type Product = {
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
  isTrackedStock?: boolean;
  stockQuantity?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductPayload = {
  categoryId: string;
  sku: string;
  name: string;
  isAvailable?: boolean;
  importPrice?: number;
  salePrice: number;
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

export type RecipeItem = {
  rawMaterialId: string;
  rawMaterialName?: string;
  unit?: string;
  quantity: number;
};

export type ProductVariant = {
  id: string;
  productId: string;
  name: string;
  sku?: string | null;
  salePrice: number;
  isDefault?: boolean;
  isActive?: boolean;
  recipeItems: RecipeItem[];
};

export type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  isActive?: boolean;
  recipeItems: RecipeItem[];
};

export type ComboItem = {
  id: string;
  componentProductId: string;
  componentProductName: string;
  componentVariantId: string;
  componentVariantName: string;
  quantity: number;
};

export type ProductConfiguration = {
  productId: string;
  productType: ProductType;
  variants: ProductVariant[];
  modifierOptions: ModifierOption[];
  comboItems: ComboItem[];
};

export type SaveProductConfigurationPayload = {
  productType?: ProductType;
  variants: Array<Omit<ProductVariant, "productId">>;
  modifierOptions: ModifierOption[];
  comboItems?: Array<{
    id?: string;
    componentProductId: string;
    componentVariantId: string;
    quantity: number;
  }>;
};

let productsRequest: ReturnType<typeof apiRequest<Product[]>> | null = null;

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

export function getProducts() {
  if (!productsRequest) {
    productsRequest = apiRequest<Product[]>({ method: "GET", url: "/products" })
      .finally(() => {
        productsRequest = null;
      });
  }

  return productsRequest;
}

export function getProductDetail(id: string) {
  return apiRequest<Product>({ method: "GET", url: `/products/${id}` });
}

export function getProductConfiguration(id: string) {
  return apiRequest<ProductConfiguration>({
    method: "GET",
    url: `/products/${id}/configuration`,
  });
}

export function getPosProductConfiguration(id: string) {
  return apiRequest<ProductConfiguration>({
    method: "GET",
    url: `/pos/products/${id}/configuration`,
  });
}

export function saveProductConfiguration(
  id: string,
  payload: SaveProductConfigurationPayload
) {
  return apiRequest<ProductConfiguration>({
    method: "PUT",
    url: `/products/${id}/configuration`,
    data: payload,
  });
}

export function createProduct(payload: CreateProductPayload) {
  return apiRequest<Product>({ method: "POST", url: "/products", data: payload });
}

export function updateProduct(id: string, payload: UpdateProductPayload) {
  return apiRequest<Product>({
    method: "PUT",
    url: `/products/${id}`,
    data: payload,
  });
}

export function updateProductStatus(
  id: string,
  payload: UpdateProductStatusPayload
) {
  return apiRequest<Product>({
    method: "PATCH",
    url: `/products/${id}/status`,
    data: payload,
  });
}

export function deleteProduct(id: string) {
  return apiRequest<Product>({ method: "DELETE", url: `/products/${id}` });
}

export async function uploadProductImage(file: File) {
  const imageBase64 = await readFileAsDataUrl(file);

  return apiRequest<UploadProductImageResult>({
    method: "POST",
    url: "/products/upload-image",
    data: {
      fileName: file.name,
      imageBase64,
    },
  });
}
