import type { Request, Response } from "express";
import {
  createCategoryService,
  getCategoriesService,
  updateCategoryService,
  updateCategoryStatusService,
} from "../services/category.service";

function getParamId(id: string | string[]) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getCategoriesController(req: Request, res: Response) {
  const categories = await getCategoriesService();

  res.json({
    success: true,
    message: "Get categories successful",
    data: categories,
  });
}

export async function createCategoryController(req: Request, res: Response) {
  const category = await createCategoryService(req.body);

  res.status(201).json({
    success: true,
    message: "Create category successful",
    data: category,
  });
}

export async function updateCategoryController(req: Request, res: Response) {
  const category = await updateCategoryService(getParamId(req.params.id), req.body);

  res.json({
    success: true,
    message: "Update category successful",
    data: category,
  });
}

export async function updateCategoryStatusController(
  req: Request,
  res: Response
) {
  const category = await updateCategoryStatusService(
    getParamId(req.params.id),
    req.body
  );

  res.json({
    success: true,
    message: "Update category status successful",
    data: category,
  });
}
