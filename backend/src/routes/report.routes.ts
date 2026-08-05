import { Router } from "express";
import { 
  getEmployeeRevenueController,
  getFinancialReportController,
  getInventoryValuationController,
  getEmployeePerformanceController,
  getComparisonReportController,
  getCustomerRetentionController,
  getAiInsightsContextController,
  getAiReportInsightsController
} from "../controllers/report.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const reportRouter = Router();

reportRouter.use(authMiddleware);
reportRouter.use(requireRoles(["ADMIN", "MANAGER"]));

reportRouter.get("/employee-revenue", asyncHandler(getEmployeeRevenueController));
reportRouter.get("/financial", asyncHandler(getFinancialReportController));
reportRouter.get("/inventory-value", asyncHandler(getInventoryValuationController));
reportRouter.get("/employee-performance", asyncHandler(getEmployeePerformanceController));
reportRouter.get("/comparison", asyncHandler(getComparisonReportController));
reportRouter.get("/customer-retention", asyncHandler(getCustomerRetentionController));
reportRouter.get("/ai-insights-context", asyncHandler(getAiInsightsContextController));
reportRouter.post("/ai-insights",asyncHandler(getAiReportInsightsController));

export default reportRouter;
