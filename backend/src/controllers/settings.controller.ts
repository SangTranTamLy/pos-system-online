import type { Request, Response } from "express";
import {
  getSettingsService,
  updateSettingsService,
  uploadLogoService,
  backupDatabaseService,
  restoreDatabaseService
} from "../services/settings.service";

export async function getSettingsController(_req: Request, res: Response) {
  const settings = await getSettingsService();
  res.json({
    success: true,
    message: "Đã tải thiết lập hệ thống.",
    data: settings,
  });
}

export async function updateSettingsController(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const settings = await updateSettingsService(req.body, userId);
  res.json({
    success: true,
    message: "Đã cập nhật thiết lập hệ thống.",
    data: settings,
  });
}

export async function uploadLogoController(req: Request, res: Response) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const logo = await uploadLogoService(req.body, baseUrl);
  res.status(201).json({
    success: true,
    message: "Đã tải ảnh logo cửa hàng.",
    data: logo,
  });
}

export async function backupDatabaseController(_req: Request, res: Response) {
  const backupData = await backupDatabaseService();
  
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=backup_${Date.now()}.json`);
  
  res.json({
    success: true,
    message: "Sao lưu thành công.",
    data: backupData,
  });
}

export async function restoreDatabaseController(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  await restoreDatabaseService(req.body, userId);
  
  res.json({
    success: true,
    message: "Khôi phục dữ liệu thành công. Vui lòng tải lại trang để cập nhật thông tin.",
  });
}
