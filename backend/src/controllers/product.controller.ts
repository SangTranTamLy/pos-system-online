import type { Request, Response } from "express";
import {
  createProductService,
  deleteProductService,
  getProductDetailService,
  getProductsService,
  uploadProductImageService,
  updateProductService,
  updateProductStatusService,
} from "../services/product.service";

function getParamId(id: string | string[]) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getProductsController(_req: Request, res: Response) {
  const products = await getProductsService();

  return res.json({
    success: true,
    message: "Đã tải danh sách sản phẩm.",
    data: products,
  });
}

export async function getProductDetailController(req: Request, res: Response) {
  const product = await getProductDetailService(getParamId(req.params.id));

  return res.json({
    success: true,
    message: "Đã tải chi tiết sản phẩm.",
    data: product,
  });
}

export async function uploadProductImageController(req: Request, res: Response) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const image = await uploadProductImageService(req.body, baseUrl);

  return res.status(201).json({
    success: true,
    message: "Đã tải ảnh sản phẩm.",
    data: image,
  });
}

export async function createProductController(req: Request, res: Response) {
  const userId = (req as any).user?.id || "";
  const product = await createProductService(req.body, userId);

  return res.status(201).json({
    success: true,
    message: "Đã tạo sản phẩm.",
    data: product,
  });
}

export async function updateProductController(req: Request, res: Response) {
  const userId = (req as any).user?.id || "";
  const product = await updateProductService(getParamId(req.params.id), req.body, userId);

  return res.json({
    success: true,
    message: "Đã cập nhật sản phẩm.",
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
    message: "Đã cập nhật trạng thái sản phẩm.",
    data: product,
  });
}

export async function deleteProductController(req: Request, res: Response) {
  const userId = (req as any).user?.id || "";
  const product = await deleteProductService(getParamId(req.params.id), userId);

  return res.json({
    success: true,
    message: "Đã xóa sản phẩm.",
    data: product,
  });
}
