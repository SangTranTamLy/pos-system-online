import type { Request, Response } from "express";
import { getEmployeeRevenueService } from "../services/report.service";
import { ApiError } from "../utils/apiError";

export async function getEmployeeRevenueController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined;

  const revenueData = await getEmployeeRevenueService(
    req.user.roleName,
    req.user.id,
    startDate,
    endDate
  );

  return res.json({
    success: true,
    message: "Lấy báo cáo doanh thu thành công",
    data: revenueData,
  });
}
