import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { createAuditLog } from "../repositories/audit-log.repository";
import { findCategoryById } from "../repositories/category.repository";
import {
  countOrderDetailsByProductId,
  createProduct,
  deleteProductById,
  findProductById,
  findProductBySku,
  findProducts,
  updateProductById,
  updateProductStatusById,
} from "../repositories/product.repository";
import type {
  CreateProductBody,
  Product,
  UpdateProductBody,
  UploadProductImageBody,
} from "../types/product.types";
import { ApiError } from "../utils/apiError";

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseImageBase64(imageBase64: string | undefined) {
  if (!imageBase64) {
    throw new ApiError(400, "Vui lòng chọn ảnh sản phẩm.");
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

function validateMoney(value: number | undefined, fieldName: string, required = false) {
  if (value === undefined) {
    if (required) {
      throw new ApiError(400, `${fieldName} là bắt buộc.`);
    }

    return;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ApiError(400, `${fieldName} không hợp lệ.`);
  }
}

function validateQuantity(value: number | null | undefined) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ApiError(400, "Số lượng tồn kho không hợp lệ.");
  }
}

export async function getProductsService() {
  return findProducts();
}

export async function getProductDetailService(id: string) {
  const product = await findProductById(id);

  if (!product) {
    throw new ApiError(404, "Không tìm thấy sản phẩm.");
  }

  return product;
}

export async function uploadProductImageService(
  body: UploadProductImageBody,
  baseUrl: string
) {
  const { extension, buffer } = parseImageBase64(body.imageBase64);
  const fileName = `${randomUUID()}.${extension}`;
  const uploadDirectory = path.join(process.cwd(), "uploads", "products");
  const filePath = path.join(uploadDirectory, fileName);

  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return {
    imageUrl: `${baseUrl}/uploads/products/${fileName}`,
  };
}

export async function createProductService(body: CreateProductBody, userId?: string) {
  try {
    if (!body.categoryId) {
      throw new ApiError(400, "Vui lòng chọn danh mục.");
    }

    const category = await findCategoryById(body.categoryId);

    if (!category) {
      throw new ApiError(404, "Danh mục không tồn tại.");
    }

    if (!body.sku?.trim()) {
      throw new ApiError(400, "Vui lòng nhập mã sản phẩm.");
    }

    const existingProduct = await findProductBySku(body.sku.trim());

    if (existingProduct) {
      throw new ApiError(409, "Mã sản phẩm đã tồn tại.");
    }

    if (!body.name?.trim()) {
      throw new ApiError(400, "Vui lòng nhập tên sản phẩm.");
    }

    validateMoney(body.salePrice, "Giá bán", true);
    validateMoney(body.importPrice, "Giá nhập");
    validateQuantity(body.stockQuantity);

    const product = await createProduct({
      ...body,
      sku: body.sku.trim(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      imageUrl: body.imageUrl?.trim() || null,
      isTrackedStock: Boolean(category.isTrackedStock),
      isAvailable: true,
    });

    if (userId) {
      void createAuditLog(
        userId,
        "SUA_SAN_PHAM",
        `Món: ${product.name}`,
        `Thêm mới sản phẩm: ${product.name} (${product.sku}). Giá bán: ${product.salePrice.toLocaleString("vi-VN")}đ.`,
        null,
        product
      );
    }

    return product;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Không tạo được sản phẩm. Vui lòng thử lại.");
  }
}

export async function updateProductService(
  id: string,
  body: UpdateProductBody,
  userId?: string
) {
  try {
    const currentProduct = await findProductById(id);

    if (!currentProduct) {
      throw new ApiError(404, "Không tìm thấy sản phẩm.");
    }

    if (!body.categoryId) {
      throw new ApiError(400, "Vui lòng chọn danh mục.");
    }

    const category = await findCategoryById(body.categoryId);

    if (!category) {
      throw new ApiError(404, "Danh mục không tồn tại.");
    }

    if (!body.sku?.trim()) {
      throw new ApiError(400, "Vui lòng nhập mã sản phẩm.");
    }

    if (!body.name?.trim()) {
      throw new ApiError(400, "Vui lòng nhập tên sản phẩm.");
    }

    validateMoney(body.salePrice, "Giá bán", true);
    validateMoney(body.importPrice, "Giá nhập");
    validateQuantity(body.stockQuantity);

    const updatedProduct = await updateProductById(id, {
      ...body,
      sku: body.sku.trim(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      imageUrl: body.imageUrl?.trim() || null,
      isTrackedStock: Boolean(category.isTrackedStock),
      isAvailable: body.isAvailable ?? currentProduct.isAvailable,
    });

    if (!updatedProduct) {
      throw new ApiError(404, "Không tìm thấy sản phẩm.");
    }

    if (userId) {
      const changes: string[] = [];
      const oldPrice = Number(currentProduct.salePrice);
      const newPrice = Number(updatedProduct.salePrice);

      if (currentProduct.name !== updatedProduct.name) {
        changes.push(`đổi tên từ "${currentProduct.name}" thành "${updatedProduct.name}"`);
      }
      if (oldPrice !== newPrice) {
        changes.push(
          `đổi giá bán từ ${oldPrice.toLocaleString("vi-VN")}đ thành ${newPrice.toLocaleString("vi-VN")}đ`
        );
      }
      if (currentProduct.imageUrl !== updatedProduct.imageUrl) {
        changes.push("thay đổi ảnh sản phẩm");
      }
      if (currentProduct.sku !== updatedProduct.sku) {
        changes.push(`đổi SKU từ "${currentProduct.sku}" thành "${updatedProduct.sku}"`);
      }

      void createAuditLog(
        userId,
        "SUA_SAN_PHAM",
        `Món: ${updatedProduct.name}`,
        changes.length > 0
          ? `Cập nhật: ${changes.join(", ")}.`
          : "Cập nhật thông tin sản phẩm.",
        currentProduct,
        updatedProduct
      );
    }

    return updatedProduct;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Không cập nhật được sản phẩm. Vui lòng thử lại.");
  }
}

export async function updateProductStatusService(
  id: string,
  body: { status?: Product["status"] },
  userId?: string
) {
  const currentProduct = await findProductById(id);

  if (!currentProduct) {
    throw new ApiError(404, "Không tìm thấy sản phẩm.");
  }

  if (!body.status) {
    throw new ApiError(400, "Vui lòng chọn trạng thái sản phẩm.");
  }

  const allowedStatuses: Product["status"][] = [
    "active",
    "paused",
    "out_of_stock",
  ];

  if (!allowedStatuses.includes(body.status)) {
    throw new ApiError(400, "Trạng thái sản phẩm không hợp lệ.");
  }

  const product = await updateProductStatusById(id, body.status);

  if (!product) {
    throw new ApiError(404, "Không tìm thấy sản phẩm.");
  }

  if (userId) {
    const statusLabels: Record<string, string> = {
      active: "Hoạt động",
      paused: "Tạm dừng",
      out_of_stock: "Hết hàng",
    };
    void createAuditLog(
      userId,
      "SUA_SAN_PHAM",
      `Món: ${currentProduct.name}`,
      `Thay đổi trạng thái sản phẩm sang: ${statusLabels[body.status] || body.status}.`,
      currentProduct,
      product
    );
  }

  return product;
}

export async function deleteProductService(id: string, userId?: string) {
  const currentProduct = await findProductById(id);

  if (!currentProduct) {
    throw new ApiError(404, "Không tìm thấy sản phẩm.");
  }

  const orderDetailCount = await countOrderDetailsByProductId(id);

  if (orderDetailCount > 0) {
    throw new ApiError(
      409,
      "Không thể xóa sản phẩm đã phát sinh hóa đơn. Hãy ngừng bán sản phẩm nếu không còn sử dụng."
    );
  }

  const isDeleted = await deleteProductById(id);

  if (!isDeleted) {
    throw new ApiError(404, "Không tìm thấy sản phẩm.");
  }

  if (userId) {
    void createAuditLog(
      userId,
      "SUA_SAN_PHAM",
      `Món: ${currentProduct.name}`,
      `Xóa sản phẩm: ${currentProduct.name} (${currentProduct.sku}).`,
      currentProduct,
      null
    );
  }

  return currentProduct;
}
