import type { Request, Response } from "express";
import { getAuditLogsService } from "../services/audit-log.service";
import { ApiError } from "../utils/apiError";
import type { AuthUser } from "../types/auth.types";

export async function getAuditLogsController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  // Chỉ Admin được xem nhật ký hệ thống
  const role = user.roleName.trim().toUpperCase();
  if (role !== "ADMIN") {
    throw new ApiError(403, "Bạn không có quyền truy cập nhật ký hệ thống");
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const actionType = typeof req.query.actionType === "string" ? req.query.actionType.trim() : undefined;
  const shiftId = typeof req.query.shiftId === "string" ? req.query.shiftId.trim() : undefined;
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : undefined;

  const data = await getAuditLogsService({
    page,
    limit,
    search,
    actionType,
    shiftId,
    startDate,
    endDate
  });

  return res.json({
    success: true,
    message: "Lấy nhật ký hệ thống thành công",
    data,
  });
}

export async function createAuditLogsController(req: Request, res: Response) {
  const user = (req as any).user as AuthUser | undefined;
  if (!user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const { actionType, targetObject, description, oldValues, newValues } = req.body;

  if (!actionType) {
    throw new ApiError(400, "Thiếu loại hành động");
  }

  const { createAuditLog } = await import("../repositories/audit-log.repository");

  await createAuditLog(
    user.id,
    actionType,
    targetObject || "",
    description || "",
    oldValues,
    newValues
  );

  return res.status(201).json({
    success: true,
    message: "Ghi nhận nhật ký thành công",
  });
}
