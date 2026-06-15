import type { Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { ApiError } from "../utils/apiError";
import {
  findAllPromotions,
  findPromotionById,
  findPromotionByCode,
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
} from "../repositories/promotions-crud.repository";

type IdParams = ParamsDictionary & { id: string };

// GET /api/promotions
export async function listPromotionsController(_req: Request, res: Response) {
  const promotions = await findAllPromotions();
  return res.json({ success: true, data: promotions });
}

// GET /api/promotions/:id
export async function getPromotionController(
  req: Request<IdParams>,
  res: Response
) {
  const id = String(req.params.id);
  const promotion = await findPromotionById(id);
  if (!promotion) throw new ApiError(404, "Không tìm thấy khuyến mãi");
  return res.json({ success: true, data: promotion });
}

function validatePromotionBody(body: Record<string, unknown>) {
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  const discountType = body.discountType as string;
  const discountValue = Number(body.discountValue);
  const startAt = body.startAt ? String(body.startAt) : null;
  const endAt = body.endAt ? String(body.endAt) : null;

  if (!code) throw new ApiError(400, "Mã khuyến mãi là bắt buộc");
  if (!/^[A-Z0-9_-]{2,30}$/.test(code))
    throw new ApiError(
      400,
      "Mã khuyến mãi chỉ gồm chữ hoa, số, _ và - (2-30 ký tự)"
    );
  if (!name) throw new ApiError(400, "Tên khuyến mãi là bắt buộc");
  if (!["percent", "fixed"].includes(discountType))
    throw new ApiError(400, "Loại giảm giá không hợp lệ (percent hoặc fixed)");
  if (!Number.isFinite(discountValue) || discountValue <= 0)
    throw new ApiError(400, "Giá trị giảm phải lớn hơn 0");
  if (discountType === "percent" && discountValue > 100)
    throw new ApiError(400, "Giảm theo % không được vượt quá 100");

  return {
    code,
    name,
    discountType: discountType as "percent" | "fixed",
    discountValue,
    startAt,
    endAt,
  };
}

// POST /api/promotions
export async function createPromotionController(req: Request, res: Response) {
  const data = validatePromotionBody(req.body as Record<string, unknown>);

  const existing = await findPromotionByCode(data.code);
  if (existing) throw new ApiError(409, "Mã khuyến mãi đã tồn tại");

  const promotion = await createPromotion(data);
  return res.status(201).json({ success: true, data: promotion });
}

// PUT /api/promotions/:id
export async function updatePromotionController(
  req: Request<IdParams>,
  res: Response
) {
  const id = String(req.params.id);
  const body = req.body as Record<string, unknown>;

  const existing = await findPromotionById(id);
  if (!existing) throw new ApiError(404, "Không tìm thấy khuyến mãi");

  const data = validatePromotionBody(body);

  const duplicateCode = await findPromotionByCode(data.code, id);
  if (duplicateCode) throw new ApiError(409, "Mã khuyến mãi đã tồn tại");

  const isActive =
    typeof body.isActive === "boolean" ? body.isActive : existing.isActive;

  const updated = await updatePromotion(id, { ...data, isActive });
  if (!updated) throw new ApiError(404, "Không tìm thấy khuyến mãi");

  return res.json({ success: true, data: updated });
}

// PATCH /api/promotions/:id/toggle
export async function togglePromotionController(
  req: Request<IdParams>,
  res: Response
) {
  const id = String(req.params.id);
  const existing = await findPromotionById(id);
  if (!existing) throw new ApiError(404, "Không tìm thấy khuyến mãi");

  const updated = await togglePromotion(id, !existing.isActive);
  return res.json({ success: true, data: updated });
}

// DELETE /api/promotions/:id
export async function deletePromotionController(
  req: Request<IdParams>,
  res: Response
) {
  const id = String(req.params.id);
  const existing = await findPromotionById(id);
  if (!existing) throw new ApiError(404, "Không tìm thấy khuyến mãi");

  await deletePromotion(id);
  return res.json({ success: true, message: "Đã xoá khuyến mãi" });
}
