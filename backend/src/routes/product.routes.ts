import { Router } from "express";
import {
  createProductController,
  getProductDetailController,
  getProductsController,
  uploadProductImageController,
  updateProductStatusController,
  updateProductController,
  deleteProductController,
  getProductRecipeController,
  saveProductRecipeController,
} from "../controllers/product.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const productRouter = Router();

productRouter.use(authMiddleware);
productRouter.get("/", asyncHandler(getProductsController));
productRouter.post("/upload-image", asyncHandler(uploadProductImageController));
productRouter.get("/:id", asyncHandler(getProductDetailController));
productRouter.get("/:id/recipe", asyncHandler(getProductRecipeController));
productRouter.post("/:id/recipe", asyncHandler(saveProductRecipeController));
productRouter.post("/", asyncHandler(createProductController));
productRouter.put("/:id", asyncHandler(updateProductController));
productRouter.patch("/:id/status", asyncHandler(updateProductStatusController));
productRouter.delete("/:id", asyncHandler(deleteProductController));
export default productRouter;
