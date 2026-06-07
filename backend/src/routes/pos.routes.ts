import { Router } from "express";
import { createPosOrderController } from "../controllers/pos.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const posRouter = Router();

posRouter.use(authMiddleware);
posRouter.post("/orders", asyncHandler(createPosOrderController));

export default posRouter;
