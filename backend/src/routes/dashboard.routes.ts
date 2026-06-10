import { Router } from "express";
import { getDashboardSummaryController } from "../controllers/dashboard.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);
dashboardRouter.get("/summary", asyncHandler(getDashboardSummaryController));

export default dashboardRouter;