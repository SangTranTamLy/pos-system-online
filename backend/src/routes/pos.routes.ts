import { Router } from "express";
import {
  createCartCancellationController,
  createPosOrderController,
  createPosOrderSyncController,
  getPosProductConfigurationController,
} from "../controllers/pos.controller";
import {
  previewPromotionController,
  validatePromotionController,
} from "../controllers/promotions.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const posRouter = Router();

posRouter.use(authMiddleware);
posRouter.get(
  "/products/:id/configuration",
  asyncHandler(getPosProductConfigurationController)
);
posRouter.post("/orders", asyncHandler(createPosOrderController));
posRouter.post("/orders/sync", asyncHandler(createPosOrderSyncController));
posRouter.post(
  "/cart-cancellations",
  requireRoles(["ADMIN", "MANAGER", "STAFF", "CASHIER"]),
  asyncHandler(createCartCancellationController)
);
posRouter.post("/promotions/preview", asyncHandler(previewPromotionController));
posRouter.post("/promotions/validate", asyncHandler(validatePromotionController));

export default posRouter;
