import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import * as shiftController from "../controllers/shift.controller";

const shiftRouter = Router();

// Everyone logged in needs access to some shift endpoints
shiftRouter.use(authMiddleware);

shiftRouter.get("/", asyncHandler(shiftController.getShiftsController));
shiftRouter.post("/", asyncHandler(shiftController.registerShiftController));
shiftRouter.patch("/:id/request-close", asyncHandler(shiftController.requestCloseShiftController));

// Manager and Admin only
shiftRouter.patch(
  "/:id/approve",
  requireRoles(["ADMIN", "MANAGER"]),
  asyncHandler(shiftController.approveShiftController)
);
shiftRouter.patch(
  "/:id/open",
  requireRoles(["ADMIN", "MANAGER"]),
  asyncHandler(shiftController.openShiftController)
);
shiftRouter.patch(
  "/:id/close",
  requireRoles(["ADMIN", "MANAGER"]),
  asyncHandler(shiftController.closeShiftController)
);
shiftRouter.patch(
  "/:id/cancel",
  requireRoles(["ADMIN", "MANAGER"]),
  asyncHandler(shiftController.cancelShiftController)
);

export default shiftRouter;
