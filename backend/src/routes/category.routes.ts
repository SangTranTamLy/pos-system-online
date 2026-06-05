import { Router } from "express";
import {
  createCategoryController,
  deleteCategoryController,
  getCategoriesController,
  uploadCategoryImageController,
  updateCategoryController,
  updateCategoryStatusController,
} from "../controllers/category.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const categoryRouter = Router();

categoryRouter.use(authMiddleware);
categoryRouter.get("/", asyncHandler(getCategoriesController));
categoryRouter.post("/upload-image", asyncHandler(uploadCategoryImageController));
categoryRouter.post("/", asyncHandler(createCategoryController));
categoryRouter.put("/:id", asyncHandler(updateCategoryController));
categoryRouter.patch("/:id/status", asyncHandler(updateCategoryStatusController));
categoryRouter.delete("/:id", asyncHandler(deleteCategoryController));

export default categoryRouter;
