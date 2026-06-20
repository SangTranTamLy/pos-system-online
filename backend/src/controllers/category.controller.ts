import type { Request, Response } from "express";
import {
  createCategoryService,
  deleteCategoryService,
  getCategoriesService,
  uploadCategoryImageService,
  updateCategoryService,
  updateCategoryStatusService,
} from "../services/category.service";

function getParamId(id: string | string[]) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getCategoriesController(_req: Request, res: Response) {
  const categories = await getCategoriesService();

  res.json({
    success: true,
    message: "Lấy danh mục thành công",
    data: categories,
  });
}

export async function createCategoryController(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const category = await createCategoryService(req.body, userId);

  res.status(201).json({
    success: true,
    message: "Tạo danh mục thành công",
    data: category,
  });
}

export async function uploadCategoryImageController(req: Request, res: Response) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const image = await uploadCategoryImageService(req.body, baseUrl);

  res.status(201).json({
    success: true,
    message: "Cập nhật ảnh danh mục thành công",
    data: image,
  });
}

export async function updateCategoryController(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const category = await updateCategoryService(getParamId(req.params.id), req.body, userId);

  res.json({
    success: true,
    message: "Cập nhật danh mục thành công",
    data: category,
  });
}

export async function updateCategoryStatusController(
  req: Request,
  res: Response
) {
  const userId = (req as any).user?.id;
  const category = await updateCategoryStatusService(
    getParamId(req.params.id),
    req.body,
    userId
  );

  res.json({
    success: true,
    message: "Cập nhật trạng thái danh mục thành công",
    data: category,
  });
}

export async function deleteCategoryController(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const category = await deleteCategoryService(getParamId(req.params.id), userId);

  res.json({
    success: true,
    message: "Xóa danh mục thành công",
    data: category,
  });
}
