import type { Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import {
  calculateBestPosPromotion,
  type PosPromotionLine,
} from "../repositories/promotions.repository";
import { ApiError } from "../utils/apiError";

type PromotionValidationItem = {
  productId?: unknown;
  quantity?: unknown;
};

type ProductPromotionRow = RowDataPacket & {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  sale_price: string;
};

function normalizePromotionItems(items: unknown) {
  if (!Array.isArray(items)) return [];

  const itemMap = new Map<string, number>();

  for (const item of items as PromotionValidationItem[]) {
    const productId = String(item.productId ?? "").trim();
    const quantity = Number(item.quantity);

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;

    itemMap.set(productId, (itemMap.get(productId) ?? 0) + quantity);
  }

  return Array.from(itemMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

async function buildPromotionLines(
  items: Array<{ productId: string; quantity: number }>
): Promise<PosPromotionLine[]> {
  if (items.length === 0) return [];

  const placeholders = items.map(() => "?").join(", ");
  const [rows] = await db.execute<ProductPromotionRow[]>(
    `
    SELECT
      products.id,
      products.name,
      products.category_id,
      categories.name AS category_name,
      products.sale_price
    FROM products
    JOIN categories ON categories.id = products.category_id
    WHERE products.id IN (${placeholders})
    `,
    items.map((item) => item.productId)
  );

  return items.flatMap((item) => {
    const product = rows.find((row) => row.id === item.productId);
    if (!product) return [];

    const unitPrice = Number(product.sale_price);
    return {
      productId: product.id,
      productName: product.name,
      categoryId: product.category_id,
      categoryName: product.category_name,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  });
}

export async function previewPromotionController(req: Request, res: Response) {
  const code = String(req.body.code ?? "").trim() || null;
  const items = normalizePromotionItems(req.body.items);
  const lines = await buildPromotionLines(items);
  const subtotal = lines.reduce((total, item) => total + item.lineTotal, 0);

  const connection = await db.getConnection();

  try {
    const appliedPromotion = await calculateBestPosPromotion(
      connection,
      lines,
      subtotal,
      code
    );

    if (code && !appliedPromotion) {
      throw new ApiError(400, "Mã khuyến mãi không hợp lệ hoặc không phù hợp với đơn hàng.");
    }

    const discountAmount = appliedPromotion?.discountAmount ?? 0;

    return res.status(200).json({
      success: true,
      message: appliedPromotion
        ? `Đang áp dụng "${appliedPromotion.name}"`
        : "Chưa có khuyến mãi phù hợp.",
      data: {
        subtotal,
        discountAmount,
        finalAmount: Math.max(0, subtotal - discountAmount),
        appliedPromotion: appliedPromotion
          ? {
              id: appliedPromotion.id,
              code: appliedPromotion.code,
              name: appliedPromotion.name,
              ruleType: appliedPromotion.ruleType,
              discountAmount,
            }
          : null,
      },
    });
  } finally {
    connection.release();
  }
}

export async function validatePromotionController(req: Request, res: Response) {
  return previewPromotionController(req, res);
}
