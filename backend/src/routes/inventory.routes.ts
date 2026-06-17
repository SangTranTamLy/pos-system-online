import { Router } from "express";
import {
  getSuppliersController,
  createSupplierController,
  updateSupplierController,
  deleteSupplierController,
  getMaterialsController,
  createMaterialController,
  updateMaterialController,
  deleteMaterialController,
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
inventoryRouter.put("/suppliers/:id", asyncHandler(updateSupplierController));
inventoryRouter.delete("/suppliers/:id", asyncHandler(deleteSupplierController));

inventoryRouter.get("/materials", asyncHandler(getMaterialsController));
inventoryRouter.post("/materials", asyncHandler(createMaterialController));
inventoryRouter.put("/materials/:id", asyncHandler(updateMaterialController));
inventoryRouter.delete("/materials/:id", asyncHandler(deleteMaterialController));

inventoryRouter.get("/receipts", asyncHandler(getGoodsReceiptsController));
inventoryRouter.post("/receipts", asyncHandler(createGoodsReceiptController));

inventoryRouter.post("/adjust", asyncHandler(createStockAdjustmentController));

export default inventoryRouter;
