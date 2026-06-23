import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ApiError } from "../utils/apiError";
import {
  findAllSettings,
  updateAllSettings,
  backupDatabase,
  restoreDatabase
} from "../repositories/settings.repository";
import { createAuditLog } from "../repositories/audit-log.repository";
import type { UploadLogoBody } from "../types/settings.types";

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseImageBase64(imageBase64: string | undefined) {
  if (!imageBase64) {
    throw new ApiError(400, "Vui lòng chọn ảnh logo.");
  }

  const match = imageBase64.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);

  if (!match) {
    throw new ApiError(400, "File ảnh không hợp lệ.");
  }

  const [, mimeType, base64Data] = match;
  const extension = allowedImageTypes[mimeType];

  if (!extension) {
    throw new ApiError(400, "Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.");
  }

  return {
    extension,
    buffer: Buffer.from(base64Data, "base64"),
  };
}

export async function getSettingsService() {
  return findAllSettings();
}

export async function updateSettingsService(data: Record<string, string>, userId?: string) {
  try {
    const currentSettings = await findAllSettings();

    // Basic validation
    if (data.store_name !== undefined && !data.store_name.trim()) {
      throw new ApiError(400, "Tên cửa hàng không được để trống.");
    }
    if (data.invoice_prefix !== undefined && !data.invoice_prefix.trim()) {
      throw new ApiError(400, "Vui lòng nhập ký hiệu hóa đơn.");
    }

    await updateAllSettings(data);
    const updatedSettings = await findAllSettings();

    if (userId) {
      void createAuditLog(
        userId,
        "SUA_CAU_HINH", // Kept old name as requested
        "Cài đặt hệ thống",
        "Cập nhật các thiết lập cài đặt của hệ thống.",
        currentSettings,
        updatedSettings
      );
    }

    return updatedSettings;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, "Không cập nhật được cài đặt.");
  }
}

export async function uploadLogoService(body: UploadLogoBody, baseUrl: string) {
  const { extension, buffer } = parseImageBase64(body.imageBase64);
  const fileName = `${randomUUID()}.${extension}`;
  const uploadDirectory = path.join(process.cwd(), "uploads", "settings");
  const filePath = path.join(uploadDirectory, fileName);

  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return {
    logoUrl: `${baseUrl}/uploads/settings/${fileName}`,
  };
}

export async function backupDatabaseService() {
  try {
    return await backupDatabase();
  } catch (error) {
    throw new ApiError(500, "Lỗi sao lưu dữ liệu.");
  }
}

export async function restoreDatabaseService(backupData: Record<string, unknown[]>, userId?: string) {
  try {
    if (!backupData || typeof backupData !== "object") {
      throw new ApiError(400, "Dữ liệu khôi phục không hợp lệ.");
    }
    
    await restoreDatabase(backupData);

    if (userId) {
      void createAuditLog(
        userId,
        "SUA_CAU_HINH", // Kept old name as requested
        "Khôi phục hệ thống",
        "Khôi phục dữ liệu hệ thống từ file sao lưu.",
        null,
        null
      );
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, "Không thể khôi phục dữ liệu.");
  }
}
