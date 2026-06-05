import {
  countProductsByCategoryId,
  createCategory,
  deleteCategoryById,
  findAllCategories,
  findCategoryById,
  findCategoryByName,
  updateCategory,
  updateCategoryStatus,
} from "../repositories/category.repository";
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryStatusBody,
  UploadCategoryImageBody,
} from "../types/category.types";
import { ApiError } from "../utils/apiError";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

function normalizeName(name: string) {
  return name.trim();
}

function normalizeDescription(description: string | null | undefined) {
  const value = description?.trim();
  return value ? value : null;
}

function normalizeImageUrl(imageUrl: string | null | undefined) {
  const value = imageUrl?.trim();
  return value ? value : null;
}

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseImageBase64(imageBase64: string | undefined) {
  if (!imageBase64) {
    throw new ApiError(400, "Vui lÃ²ng chá»n áº£nh danh má»¥c");
  }

  const match = imageBase64.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);

  if (!match) {
    throw new ApiError(400, "File áº£nh khÃ´ng há»£p lá»‡");
  }

  const [, mimeType, base64Data] = match;
  const extension = allowedImageTypes[mimeType];

  if (!extension) {
    throw new ApiError(400, "Chá»‰ há»— trá»£ áº£nh JPG, PNG, WEBP hoáº·c GIF");
  }

  return {
    extension,
    buffer: Buffer.from(base64Data, "base64"),
  };
}

export async function getCategoriesService() {
  return findAllCategories();
}

export async function uploadCategoryImageService(
  body: UploadCategoryImageBody,
  baseUrl: string
) {
  const { extension, buffer } = parseImageBase64(body.imageBase64);
  const fileName = `${randomUUID()}.${extension}`;
  const uploadDirectory = path.join(process.cwd(), "uploads", "categories");
  const filePath = path.join(uploadDirectory, fileName);

  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return {
    imageUrl: `${baseUrl}/uploads/categories/${fileName}`,
  };
}

export async function createCategoryService(body: CreateCategoryBody) {
  const name = normalizeName(body.name ?? "");

  if (!name) {
    throw new ApiError(400, "Tên danh mục là bắt buộc");
  }

  const existingCategory = await findCategoryByName(name);

  if (existingCategory) {
    throw new ApiError(409, "Tên danh mục đã tồn tại");
  }

  return createCategory({
    name,
    description: normalizeDescription(body.description),
    imageUrl: normalizeImageUrl(body.imageUrl),
  });
}

export async function updateCategoryService(
  id: string,
  body: UpdateCategoryBody
) {
  const currentCategory = await findCategoryById(id);

  if (!currentCategory) {
    throw new ApiError(404, "Không tìm thấy danh mục");
  }

  const name = normalizeName(body.name ?? "");

  if (!name) {
    throw new ApiError(400, "Tên danh mục là bắt buộc");
  }

  const existingCategory = await findCategoryByName(name);

  if (existingCategory && existingCategory.id !== id) {
    throw new ApiError(409, "Tên danh mục đã tồn tại");
  }

  const updatedCategory = await updateCategory(id, {
    name,
    description: normalizeDescription(body.description),
    imageUrl: normalizeImageUrl(body.imageUrl),
  });

  if (!updatedCategory) {
    throw new ApiError(404, "Không tìm thấy danh mục");
  }

  return updatedCategory;
}

export async function deleteCategoryService(id: string) {
  const currentCategory = await findCategoryById(id);

  if (!currentCategory) {
    throw new ApiError(404, "Không tìm thấy danh mục");
  }

  const productCount = await countProductsByCategoryId(id);

  if (productCount > 0) {
    throw new ApiError(409, "Không thể xóa danh mục đang có sản phẩm");
  }

  const isDeleted = await deleteCategoryById(id);

  if (!isDeleted) {
    throw new ApiError(404, "Không tìm thấy danh mục");
  }
  return currentCategory;
}

export async function updateCategoryStatusService(
  id: string,
  body: UpdateCategoryStatusBody
) {
  if (typeof body.isActive !== "boolean") {
    throw new ApiError(400, "Trạng thái danh mục không hợp lệ");
  }

  const updatedCategory = await updateCategoryStatus(id, body.isActive);

  if (!updatedCategory) {
    throw new ApiError(404, "Không tìm thấy danh mục");
  }

  return updatedCategory;
}
