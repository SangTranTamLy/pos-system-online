import { Router } from "express";
import { 
  getEmployeeRevenueController,
  getFinancialReportController,
  getInventoryValuationController,
  getEmployeePerformanceController,
  getComparisonReportController,
  getCustomerRetentionController
} from "../controllers/report.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const reportRouter = Router();

reportRouter.use(authMiddleware);

reportRouter.get("/employee-revenue", asyncHandler(getEmployeeRevenueController));
reportRouter.get("/financial", asyncHandler(getFinancialReportController));
reportRouter.get("/inventory-value", asyncHandler(getInventoryValuationController));
reportRouter.get("/employee-performance", asyncHandler(getEmployeePerformanceController));
reportRouter.get("/comparison", asyncHandler(getComparisonReportController));
reportRouter.get("/customer-retention", asyncHandler(getCustomerRetentionController));

export default reportRouter;
