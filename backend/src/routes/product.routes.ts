import { Router } from "express";
import {
  createProductController,
  getProductDetailController,
  getProductsController,
  uploadProductImageController,
  updateProductStatusController,
  updateProductController,
  deleteProductController,
} from "../controllers/product.controller";
import {
  getProductConfigurationController,
  saveProductConfigurationController,
} from "../controllers/product-configuration.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const productRouter = Router();

productRouter.use(authMiddleware);
productRouter.get("/", asyncHandler(getProductsController));
productRouter.get(
  "/:id/configuration",
  requireRoles(["ADMIN", "MANAGER"]),
  asyncHandler(getProductConfigurationController)
);
productRouter.get("/:id", asyncHandler(getProductDetailController));
productRouter.use(requireRoles(["ADMIN", "MANAGER"]));
productRouter.post("/upload-image", asyncHandler(uploadProductImageController));
productRouter.post("/", asyncHandler(createProductController));
productRouter.put("/:id", asyncHandler(updateProductController));
productRouter.put(
  "/:id/configuration",
  asyncHandler(saveProductConfigurationController)
);
productRouter.patch("/:id/status", asyncHandler(updateProductStatusController));
productRouter.delete("/:id", asyncHandler(deleteProductController));
export default productRouter;
