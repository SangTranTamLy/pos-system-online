import type { Request, Response } from "express";
import {
  createProductService,
  deleteProductService,
  getProductDetailService,
  getProductsService,
  uploadProductImageService,
  updateProductStatusService,
  updateProductService,
  getProductRecipeService,
  saveProductRecipeService,
} from "../services/product.service";

function getParamId(id: string | string[]) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getProductsController(_req: Request, res: Response) {
  const products = await getProductsService();

  return res.json({
    success: true,
    message: "Lấy danh sách sản phẩm thành công",
    data: products,
  });
}

export async function getProductDetailController(req: Request, res: Response) {
  const product = await getProductDetailService(getParamId(req.params.id));

  return res.json({
    success: true,
    message: "Lấy chi tiết sản phẩm thành công",
    data: product,
  });
}

export async function uploadProductImageController(req: Request, res: Response) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const image = await uploadProductImageService(req.body, baseUrl);

  return res.status(201).json({
    success: true,
    message: "Tải ảnh sản phẩm thành công",
    data: image,
  });
}

export async function createProductController(req: Request, res: Response) {
  const userId = (req as any).user?.id || "";
  const product = await createProductService(req.body, userId);

  return res.status(201).json({
    success: true,
    message: "Tạo sản phẩm thành công",
    data: product,
  });
}

export async function updateProductController(req: Request, res: Response) {
  const userId = (req as any).user?.id || "";
  const product = await updateProductService(getParamId(req.params.id), req.body, userId);

  return res.json({
    success: true,
    message: "Cập nhật sản phẩm thành công",
    data: product,
  });
}

export async function updateProductStatusController(req: Request, res: Response) {
  const userId = (req as any).user?.id || "";
  const product = await updateProductStatusService(
    getParamId(req.params.id),
    req.body,
    userId
  );

  return res.json({
    success: true,
    message: "Cập nhật trạng thái sản phẩm thành công",
    data: product,
  });
}

export async function deleteProductController(req: Request, res: Response) {
  const userId = (req as any).user?.id || "";
  const product = await deleteProductService(getParamId(req.params.id), userId);

  return res.json({
    success: true,
    message: "Xóa sản phẩm thành công",
    data: product,
  });
}

export async function getProductRecipeController(req: Request, res: Response) {
  const productId = getParamId(req.params.id);
  const recipe = await getProductRecipeService(productId);

  return res.json({
    success: true,
    message: "Lấy công thức sản phẩm thành công",
    data: recipe,
  });
}

export async function saveProductRecipeController(req: Request, res: Response) {
  const productId = getParamId(req.params.id);
  const userId = (req as any).user?.id || "";

  await saveProductRecipeService(productId, req.body, userId);

  return res.json({
    success: true,
    message: "Thiết lập công thức sản phẩm thành công",
  });
}