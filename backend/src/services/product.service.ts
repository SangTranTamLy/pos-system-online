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
} from "../types/product.types";
import { ApiError } from "../utils/apiError";

export async function getProductsService() {
  return findProducts();
}

export async function getProductDetailService(id: string) {
  const product = await findProductById(id);

  if (!product) {
    throw new ApiError(404, "Không tìm thấy sản phẩm");
  }

  return product;
}

export async function createProductService(body: CreateProductBody) {
  if (!body.categoryId) {
    throw new ApiError(400, "Vui lòng chọn danh mục");
  }

  const category = await findCategoryById(body.categoryId);

  if (!category) {
    throw new ApiError(404, "Danh mục không tồn tại");
  }

  if (!body.sku?.trim()) {
    throw new ApiError(400, "Vui lòng nhập mã sản phẩm");
  }

  const existingProduct = await findProductBySku(body.sku.trim());

  if (existingProduct) {
    throw new ApiError(409, "Mã sản phẩm đã tồn tại");
  }

  if (!body.name?.trim()) {
    throw new ApiError(400, "Vui lòng nhập tên sản phẩm");
  }

  if (body.salePrice === undefined || body.salePrice < 0) {
    throw new ApiError(400, "Giá bán không hợp lệ");
  }

  if (body.importPrice !== undefined && body.importPrice < 0) {
    throw new ApiError(400, "Giá nhập không hợp lệ");
  }

  if (body.stockQuantity !== undefined && body.stockQuantity < 0) {
    throw new ApiError(400, "Số lượng tồn kho không hợp lệ");
  }

  return createProduct({
    ...body,
    sku: body.sku.trim(),
    name: body.name.trim(),
    description: body.description?.trim() || null,
  });
}

export async function updateProductService(id: string, body: UpdateProductBody) {
  const currentProduct = await findProductById(id);

  if (!currentProduct) {
    throw new ApiError(404, "Không tìm thấy sản phẩm");
  }

  if (!body.categoryId) {
    throw new ApiError(400, "Vui lòng chọn danh mục");
  }

  const category = await findCategoryById(body.categoryId);

  if (!category) {
    throw new ApiError(404, "Danh mục không tồn tại");
  }

  if (!body.sku?.trim()) {
    throw new ApiError(400, "Vui lòng nhập mã sản phẩm");
  }

  if (!body.name?.trim()) {
    throw new ApiError(400, "Vui lòng nhập tên sản phẩm");
  }

  if (body.salePrice === undefined || body.salePrice < 0) {
    throw new ApiError(400, "Giá bán không hợp lệ");
  }

  if (body.importPrice !== undefined && body.importPrice < 0) {
    throw new ApiError(400, "Giá nhập không hợp lệ");
  }

  if (body.stockQuantity !== undefined && body.stockQuantity < 0) {
    throw new ApiError(400, "Số lượng tồn kho không hợp lệ");
  }

  const updatedProduct = await updateProductById(id, {
    ...body,
    sku: body.sku.trim(),
    name: body.name.trim(),
    description: body.description?.trim() || null,
  });

  if (!updatedProduct) {
    throw new ApiError(404, "Không tìm thấy sản phẩm");
  }

  return updatedProduct;
}

export async function updateProductStatusService(
  id: string,
  body: { status?: Product["status"] }
) {
  const currentProduct = await findProductById(id);

  if (!currentProduct) {
    throw new ApiError(404, "Không tìm thấy sản phẩm");
  }

  if (!body.status) {
    throw new ApiError(400, "Vui lòng chọn trạng thái sản phẩm");
  }

  const allowedStatuses: Product["status"][] = [
    "active",
    "paused",
    "out_of_stock",
  ];

  if (!allowedStatuses.includes(body.status)) {
    throw new ApiError(400, "Trạng thái sản phẩm không hợp lệ");
  }

  const product = await updateProductStatusById(id, body.status);

  if (!product) {
    throw new ApiError(404, "Không tìm thấy sản phẩm");
  }

  return product;
}

export async function deleteProductService(id: string) {
  const currentProduct = await findProductById(id);

  if (!currentProduct) {
    throw new ApiError(404, "Không tìm thấy sản phẩm");
  }

  const orderDetailCount = await countOrderDetailsByProductId(id);

  if (orderDetailCount > 0) {
    throw new ApiError(409, "Không thể xóa sản phẩm đã phát sinh hóa đơn");
  }

  const isDeleted = await deleteProductById(id);

  if (!isDeleted) {
    throw new ApiError(404, "Không tìm thấy sản phẩm");
  }

  return currentProduct;
}
