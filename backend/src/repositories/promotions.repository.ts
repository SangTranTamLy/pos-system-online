import type { RowDataPacket, PoolConnection } from "mysql2/promise";
import { db } from "../config/database";

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

export type ValidatedPromotion = {
  id: string;
  discountType: "percent" | "fixed";
  discountValue: number;
};

export async function findPromotionByCode(
  connection: PoolConnection,
  code: string
): Promise<ValidatedPromotion | null> {
  const now = new Date();

  const [rows] = await connection.execute<PromotionRow[]>(
    `
    SELECT id, code, discount_type, discount_value, start_at, end_at, is_active
    FROM promotions
    WHERE code = ? AND is_active = 1
      AND (start_at IS NULL OR start_at <= ?)
      AND (end_at IS NULL OR end_at > ?)
    LIMIT 1
    `,
    [code, now, now]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
  };
}

export function calculateDiscount(
  totalAmount: number,
  promotion: ValidatedPromotion
): number {
  if (promotion.discountType === "percent") {
    return (totalAmount * promotion.discountValue) / 100;
  }
  return Math.min(promotion.discountValue, totalAmount);
}
