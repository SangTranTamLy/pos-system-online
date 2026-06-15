import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  listPromotionsController,
  getPromotionController,
  createPromotionController,
  updatePromotionController,
  togglePromotionController,
  deletePromotionController,
} from "../controllers/promotions-crud.controller";

const promotionsRouter = Router();

promotionsRouter.use(authMiddleware);

promotionsRouter.get("/", asyncHandler(listPromotionsController));
promotionsRouter.get("/:id", asyncHandler(getPromotionController));
promotionsRouter.post("/", asyncHandler(createPromotionController));
promotionsRouter.put("/:id", asyncHandler(updatePromotionController));
promotionsRouter.patch("/:id/toggle", asyncHandler(togglePromotionController));
promotionsRouter.delete("/:id", asyncHandler(deletePromotionController));

export default promotionsRouter;
