import { Router } from "express";
import { createPosOrderController } from "../controllers/pos.controller";
import {
  previewPromotionController,
  validatePromotionController,
} from "../controllers/promotions.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const posRouter = Router();

posRouter.use(authMiddleware);
posRouter.post("/orders", asyncHandler(createPosOrderController));
posRouter.post("/promotions/preview", asyncHandler(previewPromotionController));
posRouter.post("/promotions/validate", asyncHandler(validatePromotionController));

export default posRouter;
