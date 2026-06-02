import { Router } from "express";
import {
  createCategoryController,
  getCategoriesController,
  updateCategoryController,
  updateCategoryStatusController,
} from "../controllers/category.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const categoryRouter = Router();

categoryRouter.use(authMiddleware);
categoryRouter.get("/", asyncHandler(getCategoriesController));
categoryRouter.post("/", asyncHandler(createCategoryController));
categoryRouter.put("/:id", asyncHandler(updateCategoryController));
categoryRouter.patch("/:id/status", asyncHandler(updateCategoryStatusController));

export default categoryRouter;
