import {
  createCategory,
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
} from "../types/category.types";
import { ApiError } from "../utils/apiError";

function normalizeName(name: string) {
  return name.trim();
}

function normalizeDescription(description: string | null | undefined) {
  const value = description?.trim();
  return value ? value : null;
}

export async function getCategoriesService() {
  return findAllCategories();
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
  });

  if (!updatedCategory) {
    throw new ApiError(404, "Không tìm thấy danh mục");
  }

  return updatedCategory;
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
