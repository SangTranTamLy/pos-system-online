import { Router } from "express";
import {
  getAuditLogsController,
  createAuditLogsController,
} from "../controllers/audit-log.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const auditLogRouter = Router();

auditLogRouter.use(authMiddleware);
auditLogRouter.get(
  "/",
  requireRoles(["ADMIN"]),
  asyncHandler(getAuditLogsController)
);
auditLogRouter.post(
  "/",
  requireRoles(["ADMIN", "MANAGER", "STAFF", "CASHIER"]),
  asyncHandler(createAuditLogsController)
);

export default auditLogRouter;
