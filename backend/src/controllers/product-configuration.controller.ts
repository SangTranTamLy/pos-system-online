import type { Request, Response } from "express";
import {
  getProductConfigurationService,
  saveProductConfigurationService,
} from "../services/product-configuration.service";

function idParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function getProductConfigurationController(req: Request, res: Response) {
  const data = await getProductConfigurationService(idParam(req.params.id));
  return res.json({ success: true, message: "Đã tải cấu hình sản phẩm.", data });
}

export async function saveProductConfigurationController(req: Request, res: Response) {
  const data = await saveProductConfigurationService(
    idParam(req.params.id),
    req.body,
    req.user?.id
  );
  return res.json({ success: true, message: "Đã cập nhật cấu hình sản phẩm.", data });
}
