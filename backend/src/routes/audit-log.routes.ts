import { Router } from "express";
import {
  getAuditLogsController,
  createAuditLogsController,
} from "../controllers/audit-log.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const auditLogRouter = Router();

auditLogRouter.use(authMiddleware);
auditLogRouter.get("/", asyncHandler(getAuditLogsController));
auditLogRouter.post("/", asyncHandler(createAuditLogsController));

export default auditLogRouter;
