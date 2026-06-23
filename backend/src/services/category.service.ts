import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { createAuditLog } from "../repositories/audit-log.repository";
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

function normalizeCategoryStockLogic(input: { isTrackedStock?: boolean }) {
  return {
    isTrackedStock: Boolean(input.isTrackedStock),
  };
}

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseImageBase64(imageBase64: string | undefined) {
  if (!imageBase64) {
    throw new ApiError(400, "Vui lòng chọn ảnh danh mục.");
  }

  const match = imageBase64.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);

  if (!match) {
    throw new ApiError(400, "File ảnh không hợp lệ.");
  }

  const [, mimeType, base64Data] = match;
  const extension = allowedImageTypes[mimeType];

  if (!extension) {
    throw new ApiError(400, "Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.");
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

export async function createCategoryService(body: CreateCategoryBody, userId?: string) {
  try {
    const name = normalizeName(body.name ?? "");

    if (!name) {
      throw new ApiError(400, "Tên danh mục là bắt buộc.");
    }

    const existingCategory = await findCategoryByName(name);

    if (existingCategory) {
      throw new ApiError(409, "Tên danh mục đã tồn tại.");
    }

    const stockLogic = normalizeCategoryStockLogic({
      isTrackedStock: body.isTrackedStock,
    });

    const category = await createCategory({
      name,
      description: normalizeDescription(body.description),
      imageUrl: normalizeImageUrl(body.imageUrl),
      ...stockLogic,
    });

    if (userId) {
      void createAuditLog(
        userId,
        "SUA_DANH_MUC",
        `Danh mục: ${category.name}`,
        `Tạo mới danh mục: ${category.name}.`,
        null,
        category
      );
    }

    return category;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, "Không tạo được danh mục.");
  }
}

export async function updateCategoryService(
  id: string,
  body: UpdateCategoryBody,
  userId?: string
) {
  try {
    const currentCategory = await findCategoryById(id);

    if (!currentCategory) {
      throw new ApiError(404, "Không tìm thấy danh mục.");
    }

    const name = normalizeName(body.name ?? "");

    if (!name) {
      throw new ApiError(400, "Tên danh mục là bắt buộc.");
    }

    const existingCategory = await findCategoryByName(name);

    if (existingCategory && existingCategory.id !== id) {
      throw new ApiError(409, "Tên danh mục đã tồn tại.");
    }

    const stockLogic = normalizeCategoryStockLogic({
      isTrackedStock:
        typeof body.isTrackedStock === "boolean"
          ? body.isTrackedStock
          : currentCategory.isTrackedStock,
    });

    const updatedCategory = await updateCategory(id, {
      name,
      description: normalizeDescription(body.description),
      imageUrl: normalizeImageUrl(body.imageUrl),
      ...stockLogic,
    });

    if (!updatedCategory) {
      throw new ApiError(404, "Không tìm thấy danh mục.");
    }

    if (userId) {
      void createAuditLog(
        userId,
        "SUA_DANH_MUC",
        `Danh mục: ${updatedCategory.name}`,
        `Cập nhật danh mục: ${updatedCategory.name}.`,
        currentCategory,
        updatedCategory
      );
    }

    return updatedCategory;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, "Không cập nhật được danh mục.");
  }
}

export async function deleteCategoryService(id: string, userId?: string) {
  const currentCategory = await findCategoryById(id);

  if (!currentCategory) {
    throw new ApiError(404, "Không tìm thấy danh mục.");
  }

  const productCount = await countProductsByCategoryId(id);

  if (productCount > 0) {
    throw new ApiError(409, "Không thể xóa danh mục đang có sản phẩm.");
  }

  const isDeleted = await deleteCategoryById(id);

  if (!isDeleted) {
    throw new ApiError(404, "Không tìm thấy danh mục.");
  }

  if (userId) {
    void createAuditLog(
      userId,
      "SUA_DANH_MUC",
      `Danh mục: ${currentCategory.name}`,
      `Xóa danh mục: ${currentCategory.name}.`,
      currentCategory,
      null
    );
  }

  return currentCategory;
}

export async function updateCategoryStatusService(
  id: string,
  body: UpdateCategoryStatusBody,
  userId?: string
) {
  if (typeof body.isActive !== "boolean") {
    throw new ApiError(400, "Trạng thái danh mục không hợp lệ.");
  }

  const currentCategory = await findCategoryById(id);
  const updatedCategory = await updateCategoryStatus(id, body.isActive);

  if (!updatedCategory) {
    throw new ApiError(404, "Không tìm thấy danh mục.");
  }

  if (userId && currentCategory) {
    const statusLabel = body.isActive ? "Hoạt động" : "Tạm dừng";
    void createAuditLog(
      userId,
      "SUA_DANH_MUC",
      `Danh mục: ${updatedCategory.name}`,
      `Thay đổi trạng thái danh mục sang: ${statusLabel}.`,
      currentCategory,
      updatedCategory
    );
  }

  return updatedCategory;
}
