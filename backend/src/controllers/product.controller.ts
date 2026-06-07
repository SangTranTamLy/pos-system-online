import type { Request, Response } from "express";
import {
  createProductService,
  deleteProductService,
  getProductDetailService,
  getProductsService,
  uploadProductImageService,
  updateProductStatusService,
  updateProductService,
} from "../services/product.service";

function getParamId(id: string | string[]) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getProductsController(_req: Request, res: Response) {
  const products = await getProductsService();

  return res.json({
    success: true,
    message: "Get products successful",
    data: products,
  });
}

export async function getProductDetailController(req: Request, res: Response) {
  const product = await getProductDetailService(getParamId(req.params.id));

  return res.json({
    success: true,
    message: "Get product detail successful",
    data: product,
  });
}

export async function uploadProductImageController(req: Request, res: Response) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const image = await uploadProductImageService(req.body, baseUrl);

  return res.status(201).json({
    success: true,
    message: "Upload product image successful",
    data: image,
  });
}

export async function createProductController(req: Request, res: Response) {
  const product = await createProductService(req.body);

  return res.status(201).json({
    success: true,
    message: "Create product successful",
    data: product,
  });
}

export async function updateProductController(req: Request, res: Response) {
  const product = await updateProductService(getParamId(req.params.id), req.body);

  return res.json({
    success: true,
    message: "Update product successful",
    data: product,
  });
}

export async function updateProductStatusController(req: Request, res: Response) {
  const product = await updateProductStatusService(
    getParamId(req.params.id),
    req.body
  );

  return res.json({
    success: true,
    message: "Update product status successful",
    data: product,
  });
}

export async function deleteProductController(req: Request, res: Response) {
  const product = await deleteProductService(getParamId(req.params.id));

  return res.json({
    success: true,
    message: "Delete product successful",
    data: product,
  });
}
