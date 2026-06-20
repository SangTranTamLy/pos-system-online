import type { Request, Response } from "express";
import { 
  getEmployeeRevenueService,
  getFinancialReportService,
  getInventoryValuationService,
  getEmployeePerformanceService,
  getComparisonReportService,
  getCustomerRetentionService
} from "../services/report.service";
import { ApiError } from "../utils/apiError";
import type { AuthUser } from "../types/auth.types";

// Helper kiểm tra quyền Admin hoặc Manager
function checkAdminOrManager(user: AuthUser | undefined) {
  if (!user) {
    throw new ApiError(401, "Chưa được xác thực");
  }
  const role = user.roleName.trim().toUpperCase();
  if (role !== "ADMIN" && role !== "MANAGER") {
    throw new ApiError(403, "Bạn không có quyền truy cập báo cáo này");
  }
}

export async function getEmployeeRevenueController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined;

  const revenueData = await getEmployeeRevenueService(
    user.roleName,
    user.id,
    startDate,
    endDate
  );

  return res.json({
    success: true,
    message: "Lấy báo cáo doanh thu thành công",
    data: revenueData,
  });
}

// 1. Controller báo cáo tài chính (Doanh thu - Vốn - Lợi nhuận)
export async function getFinancialReportController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined;

  const data = await getFinancialReportService(startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo tài chính thành công",
    data,
  });
}

// 2. Controller báo cáo tồn kho & giá trị kho
export async function getInventoryValuationController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const data = await getInventoryValuationService();

  return res.json({
    success: true,
    message: "Lấy báo cáo giá trị kho thành công",
    data,
  });
}

// 3. Controller báo cáo hiệu suất nhân viên
export async function getEmployeePerformanceController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined;

  const data = await getEmployeePerformanceService(startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo hiệu suất nhân viên thành công",
    data,
  });
}

// 4. Controller báo cáo so sánh & tăng trưởng
export async function getComparisonReportController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined;

  if (!startDate || !endDate) {
    throw new ApiError(400, "Vui lòng cung cấp đầy đủ startDate và endDate");
  }

  const data = await getComparisonReportService(startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo so sánh thành công",
    data,
  });
}

// 5. Controller báo cáo khách hàng thân thiết
export async function getCustomerRetentionController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  checkAdminOrManager(user);

  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined;

  const data = await getCustomerRetentionService(startDate, endDate);

  return res.json({
    success: true,
    message: "Lấy báo cáo khách hàng thân thiết thành công",
    data,
  });
}
