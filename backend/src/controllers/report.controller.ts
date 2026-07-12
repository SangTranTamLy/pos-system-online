import type { Request, Response } from "express";
import {
  getAiInsightsContextService,
  getAiReportInsightsService,
  getComparisonReportService,
  getCustomerRetentionService,
  getEmployeePerformanceService,
  getEmployeeRevenueService,
  getFinancialReportService,
  getInventoryValuationService,
} from "../services/report.service";
import type { AuthUser } from "../types/auth.types";
import { ApiError } from "../utils/apiError";

function checkAdminOrManager(user: AuthUser | undefined) {
  if (!user) {
    throw new ApiError(401, "Chua duoc xac thuc");
  }

  const role = user.roleName.trim().toUpperCase();
  if (role !== "ADMIN" && role !== "MANAGER") {
    throw new ApiError(403, "Bạn không có quyến truy cập vào báo cáo này.");
  }
}

function getDateRange(req: Request) {
  return {
    startDate: typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined,
    endDate: typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined,
  };
}

function requireDateRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) {
    throw new ApiError(400, "Vui lòng cung cấp đầy đủ ngày bắt đầu và ngày kết thúc");
  }
}

export async function getAiInsightsContextController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const { startDate, endDate } = getDateRange(req);
  requireDateRange(startDate, endDate);

  const data = await getAiInsightsContextService(startDate!, endDate!);

  return res.json({
    success: true,
    message: "Lấy dữ liệu đầu vào cho AI thành công",
    data,
  });
}

export async function getAiReportInsightsController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const { startDate, endDate } = getDateRange(req);
  requireDateRange(startDate, endDate);

  const result = await getAiReportInsightsService(startDate!, endDate!, user?.id);

  return res.json({
    success: true,
    message: "Lấy gợi ý báo cáo từ AI thành công",
    data: result,
  });
}

export async function getEmployeeRevenueController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const { startDate, endDate } = getDateRange(req);
  const data = await getEmployeeRevenueService(user.roleName, user.id, startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo doanh thu thành công",
    data,
  });
}

export async function getFinancialReportController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const { startDate, endDate } = getDateRange(req);
  const data = await getFinancialReportService(startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo tài chính thành công",
    data,
  });
}

export async function getInventoryValuationController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const data = await getInventoryValuationService();

  return res.json({
    success: true,
    message: "Lấy báo cáo tồn kho thành công",
    data,
  });
}

export async function getEmployeePerformanceController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const { startDate, endDate } = getDateRange(req);
  const data = await getEmployeePerformanceService(startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo hiệu suất nhân viên thành công",
    data,
  });
}

export async function getComparisonReportController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const { startDate, endDate } = getDateRange(req);
  requireDateRange(startDate, endDate);

  const data = await getComparisonReportService(startDate!, endDate!);

  return res.json({
    success: true,
    message: "Lấy báo cáo so sánh thành công",
    data,
  });
}

export async function getCustomerRetentionController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const { startDate, endDate } = getDateRange(req);
  const data = await getCustomerRetentionService(startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo giữ chân khách hàng thành công",
    data,
  });
}
