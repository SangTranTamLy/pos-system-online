import { Router } from "express";
import {
  cancelOrderController,
  getOrderDetailController,
  getOrdersController,
} from "../controllers/order.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const orderRouter = Router();

orderRouter.use(authMiddleware);
orderRouter.get("/", asyncHandler(getOrdersController));
orderRouter.get("/:id", asyncHandler(getOrderDetailController));
orderRouter.post(
  "/:id/cancel",
  requireRoles(["ADMIN"]),
  asyncHandler(cancelOrderController)
);
orderRouter.patch(
  "/:id/cancel",
  requireRoles(["ADMIN"]),
  asyncHandler(cancelOrderController)
);

export default orderRouter;