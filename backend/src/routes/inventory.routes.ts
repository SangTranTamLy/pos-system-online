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
  payGoodsReceiptDebtController,
  getInventoryAuditsController,
  getInventoryAuditByIdController,
  createInventoryAuditController,
  updateInventoryAuditController,
  deleteInventoryAuditController,
} from "../controllers/inventory.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const inventoryRouter = Router();

inventoryRouter.use(authMiddleware);
inventoryRouter.use(requireRoles(["ADMIN", "MANAGER"]));

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
inventoryRouter.put("/receipts/:id/pay", asyncHandler(payGoodsReceiptDebtController));

// Inventory Audits routes
inventoryRouter.get("/audits", asyncHandler(getInventoryAuditsController));
inventoryRouter.get("/audits/:id", asyncHandler(getInventoryAuditByIdController));
inventoryRouter.post("/audits", asyncHandler(createInventoryAuditController));
inventoryRouter.put("/audits/:id", asyncHandler(updateInventoryAuditController));
inventoryRouter.delete("/audits/:id", asyncHandler(deleteInventoryAuditController));

export default inventoryRouter;
