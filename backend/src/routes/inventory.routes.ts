import { Router } from "express";
import {
  getSuppliersController,
  createSupplierController,
  getGoodsReceiptsController,
  createGoodsReceiptController,
  createStockAdjustmentController,
} from "../controllers/inventory.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const inventoryRouter = Router();

inventoryRouter.use(authMiddleware);

inventoryRouter.get("/suppliers", asyncHandler(getSuppliersController));
inventoryRouter.post("/suppliers", asyncHandler(createSupplierController));

inventoryRouter.get("/receipts", asyncHandler(getGoodsReceiptsController));
inventoryRouter.post("/receipts", asyncHandler(createGoodsReceiptController));

inventoryRouter.post("/adjust", asyncHandler(createStockAdjustmentController));

export default inventoryRouter;
