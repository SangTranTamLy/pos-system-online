import { apiRequest } from "./api-client";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryPayload = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type UpdateCategoryPayload = CreateCategoryPayload;

export type UpdateCategoryStatusPayload = {
  isActive: boolean;
};

export type UploadCategoryImageResult = {
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

      reject(new Error("Không đọc được file ảnh."));
    };

    reader.onerror = () => {
      reject(new Error("Không đọc được file ảnh."));
    };

    reader.readAsDataURL(file);
  });
}

export function getCategories() {
  return apiRequest<Category[]>({ method: "GET", url: "/categories" });
}

export function createCategory(payload: CreateCategoryPayload) {
  return apiRequest<Category>({
    method: "POST",
    url: "/categories",
    data: payload,
  });
}

export function updateCategory(id: string, payload: UpdateCategoryPayload) {
  return apiRequest<Category>({
    method: "PUT",
    url: `/categories/${id}`,
    data: payload,
  });
}

export function updateCategoryStatus(
  id: string,
  payload: UpdateCategoryStatusPayload
) {
  return apiRequest<Category>({
    method: "PATCH",
    url: `/categories/${id}/status`,
    data: payload,
  });
}

export function deleteCategory(id: string) {
  return apiRequest<Category>({ method: "DELETE", url: `/categories/${id}` });
}

export async function uploadCategoryImage(file: File) {
  const imageBase64 = await readFileAsDataUrl(file);

  return apiRequest<UploadCategoryImageResult>({
    method: "POST",
    url: "/categories/upload-image",
    data: {
      fileName: file.name,
      imageBase64,
    },
  });
}
