import { Router } from "express";
import {
  createProductController,
  getProductDetailController,
  getProductsController,
  updateProductStatusController,
  updateProductController,
  deleteProductController
} from "../controllers/product.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const productRouter = Router();

productRouter.use(authMiddleware);
productRouter.get("/", asyncHandler(getProductsController));
productRouter.get("/:id", asyncHandler(getProductDetailController));
productRouter.post("/", asyncHandler(createProductController));
productRouter.put("/:id", asyncHandler(updateProductController));
productRouter.patch("/:id/status", asyncHandler(updateProductStatusController));
productRouter.delete("/:id", asyncHandler(deleteProductController));
export default productRouter;
