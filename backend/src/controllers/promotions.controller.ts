import type { Request, Response } from "express";
import { db } from "../config/database";
import type { RowDataPacket, PoolConnection } from "mysql2/promise";
import { ApiError } from "../utils/apiError";

type PromotionRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  start_at: Date | null;
  end_at: Date | null;
  is_active: number;
};

export async function validatePromotionController(req: Request, res: Response) {
  const { code } = req.body;

  if (!code?.trim()) {
    throw new ApiError(400, "Vui lòng cung cấp mã khuyến mãi");
  }

  const now = new Date();

  const [rows] = await db.execute<PromotionRow[]>(
    `
    SELECT id, code, name, discount_type, discount_value, start_at, end_at, is_active
    FROM promotions
    WHERE code = ? AND is_active = 1
      AND (start_at IS NULL OR start_at <= ?)
      AND (end_at IS NULL OR end_at > ?)
    LIMIT 1
    `,
    [code.trim(), now, now]
  );

  const promotion = rows[0];

  if (!promotion) {
    throw new ApiError(400, "Mã khuyến mãi không hợp lệ hoặc đã hết hạn");
  }

  const discountValue = Number(promotion.discount_value);
  const response =
    promotion.discount_type === "percent"
      ? { discountPercent: discountValue }
      : { discountFixed: discountValue };

  return res.status(200).json({
    success: true,
    message: `Khuyến mãi "${promotion.name}" - Giảm ${
      promotion.discount_type === "percent" ? discountValue + "%" : `${discountValue} VND`
    }`,
    data: response,
  });
}
