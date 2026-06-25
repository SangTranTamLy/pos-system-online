import { apiRequest } from "./api-client";

export type ProductStatus = "active" | "paused" | "out_of_stock";

export type Product = {
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
};

export type CreateProductPayload = {
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
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export type UpdateProductStatusPayload = {
  status: ProductStatus;
};

export type UploadProductImageResult = {
  imageUrl: string;
};

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
  return apiRequest<Product[]>({ method: "GET", url: "/products" });
}

export function getProductDetail(id: string) {
  return apiRequest<Product>({ method: "GET", url: `/products/${id}` });
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
