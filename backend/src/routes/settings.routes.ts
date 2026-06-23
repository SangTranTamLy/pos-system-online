import { Router } from "express";
import {
  getSettingsController,
  updateSettingsController,
  uploadLogoController,
  backupDatabaseController,
  restoreDatabaseController
} from "../controllers/settings.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const settingsRouter = Router();

settingsRouter.use(authMiddleware);

// All authenticated users can read settings
settingsRouter.get("/", asyncHandler(getSettingsController));

// Only ADMIN can modify configurations, backup, or restore
settingsRouter.put("/", requireRoles(["admin"]), asyncHandler(updateSettingsController));
settingsRouter.post("/upload-logo", requireRoles(["admin"]), asyncHandler(uploadLogoController));
settingsRouter.get("/backup", requireRoles(["admin"]), asyncHandler(backupDatabaseController));
settingsRouter.post("/restore", requireRoles(["admin"]), asyncHandler(restoreDatabaseController));

export default settingsRouter;
