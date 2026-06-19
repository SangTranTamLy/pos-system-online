import { Router } from "express";
import { getEmployeeRevenueController } from "../controllers/report.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const reportRouter = Router();

reportRouter.use(authMiddleware);
reportRouter.get("/employee-revenue", asyncHandler(getEmployeeRevenueController));

export default reportRouter;
