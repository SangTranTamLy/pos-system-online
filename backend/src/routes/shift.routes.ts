import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import * as shiftController from "../controllers/shift.controller";

const shiftRouter = Router();

// Everyone logged in needs access to some shift endpoints
shiftRouter.use(authMiddleware);

shiftRouter.get("/revenue-by-shift", asyncHandler(shiftController.getShiftRevenueSummaryController));
shiftRouter.get("/staff-by-shift", asyncHandler(shiftController.getStaffByShiftSummaryController));
shiftRouter.get("/", asyncHandler(shiftController.getShiftsController));
shiftRouter.post(
  "/open-for-employee",
  requireRoles(["ADMIN", "MANAGER"]),
  asyncHandler(shiftController.openShiftForEmployeeController)
);
shiftRouter.post("/", requireRoles(["ADMIN", "MANAGER"]), asyncHandler(shiftController.registerShiftController));
shiftRouter.patch("/:id/request-close", asyncHandler(shiftController.requestCloseShiftController));
shiftRouter.patch("/:id/request-open", asyncHandler(shiftController.requestOpenShiftController));
shiftRouter.patch("/:id/opening-cash", asyncHandler(shiftController.setOpeningCashController));
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
