import type { Request, Response } from "express";
import { findProductById } from "../repositories/product.repository";
import {
  createPromotion,
  deletePromotion,
  findAllPromotions,
  findPromotionByCode,
  findPromotionById,
  togglePromotion,
  updatePromotion,
} from "../repositories/promotions.repository";
import { ApiError } from "../utils/apiError";
import { createAuditLog } from "../repositories/audit-log.repository";

export async function listPromotionsController(_req: Request, res: Response) {
  const promotions = await findAllPromotions();
  return res.json({ success: true, data: promotions });
}

export async function getPromotionController(req: Request, res: Response) {
  const id = String(req.params.id);
  const promotion = await findPromotionById(id);
  if (!promotion) throw new ApiError(404, "Không tìm thấy khuyến mãi.");
  return res.json({ success: true, data: promotion });
}

function validatePromotionBody(body: Record<string, unknown>) {
  const productId = String(body.productId ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  const discountType = body.discountType as string;
  const discountValue = Number(body.discountValue);
  const startAt = body.startAt ? String(body.startAt) : null;
  const endAt = body.endAt ? String(body.endAt) : null;

  if (!productId) throw new ApiError(400, "Vui lòng chọn sản phẩm áp dụng.");
  if (!code) throw new ApiError(400, "Vui lòng nhập mã khuyến mãi.");
  if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
    throw new ApiError(
      400,
      "Mã khuyến mãi chỉ gồm chữ hoa, số, _ và - (2-30 ký tự)."
    );
  }
  if (!name) throw new ApiError(400, "Vui lòng nhập tên khuyến mãi.");
  if (!["percent", "fixed"].includes(discountType)) {
    throw new ApiError(400, "Loại giảm giá không hợp lệ.");
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new ApiError(400, "Gia tri giam phai lon hon 0");
  }
  if (discountType === "percent" && discountValue > 100) {
    throw new ApiError(400, "Giảm theo % không được vượt quá 100.");
  }

  return {
    productId,
    code,
    name,
    discountType: discountType as "percent" | "fixed",
    discountValue,
    startAt,
    endAt,
  };
}

async function ensurePromotionProductExists(productId: string) {
  const product = await findProductById(productId);
  if (!product) throw new ApiError(404, "Không tìm thấy sản phẩm áp dụng.");
}

export async function createPromotionController(req: Request, res: Response) {
  const data = validatePromotionBody(req.body as Record<string, unknown>);

  await ensurePromotionProductExists(data.productId);

  const existing = await findPromotionByCode(data.code);
  if (existing) throw new ApiError(409, "Mã khuyến mãi đã tồn tại.");

  const promotion = await createPromotion(data);

  const userId = (req as any).user?.id;
  if (userId && promotion) {
    void createAuditLog(
      userId,
      "SUA_KHUYEN_MAI",
      `Mã KM: ${promotion.code}`,
      `Tạo mới chiến dịch khuyến mãi: ${promotion.name} (Mã: ${promotion.code}).`,
      null,
      promotion
    );
  }

  return res.status(201).json({ success: true, data: promotion });
}

export async function updatePromotionController(req: Request, res: Response) {
  const id = String(req.params.id);
  const body = req.body as Record<string, unknown>;

  const existing = await findPromotionById(id);
  if (!existing) throw new ApiError(404, "Không tìm thấy khuyến mãi.");

  const data = validatePromotionBody(body);
  await ensurePromotionProductExists(data.productId);

  const duplicateCode = await findPromotionByCode(data.code, id);
  if (duplicateCode) throw new ApiError(409, "Mã khuyến mãi đã tồn tại.");

  const isActive =
    typeof body.isActive === "boolean" ? body.isActive : existing.isActive;

  const updated = await updatePromotion(id, { ...data, isActive });
  if (!updated) throw new ApiError(404, "Không tìm thấy khuyến mãi.");

  const userId = (req as any).user?.id;
  if (userId) {
    void createAuditLog(
      userId,
      "SUA_KHUYEN_MAI",
      `Mã KM: ${updated.code}`,
      `Cập nhật chiến dịch khuyến mãi: ${updated.name} (Mã: ${updated.code}).`,
      existing,
      updated
    );
  }

  return res.json({ success: true, data: updated });
}

export async function togglePromotionController(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await findPromotionById(id);
  if (!existing) throw new ApiError(404, "Không tìm thấy khuyến mãi.");

  const updated = await togglePromotion(id, !existing.isActive);

  const userId = (req as any).user?.id;
  if (userId && updated) {
    const statusLabel = updated.isActive ? "Hoạt động" : "Tạm dừng";
    void createAuditLog(
      userId,
      "SUA_KHUYEN_MAI",
      `Mã KM: ${updated.code}`,
      `Thay đổi trạng thái khuyến mãi ${updated.name} thành: ${statusLabel}.`,
      existing,
      updated
    );
  }

  return res.json({ success: true, data: updated });
}

export async function deletePromotionController(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await findPromotionById(id);
  if (!existing) throw new ApiError(404, "Không tìm thấy khuyến mãi.");

  await deletePromotion(id);

  const userId = (req as any).user?.id;
  if (userId) {
    void createAuditLog(
      userId,
      "SUA_KHUYEN_MAI",
      `Mã KM: ${existing.code}`,
      `Xóa chiến dịch khuyến mãi: ${existing.name} (Mã: ${existing.code}).`,
      existing,
      null
    );
  }

  return res.json({ success: true, message: "Đã xóa khuyến mãi." });
}
