import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "../config/database";

export type Promotion = {
  id: string;
  code: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PromotionRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  start_at: Date | null;
  end_at: Date | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

function mapPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    startAt: row.start_at ? row.start_at.toISOString() : null,
    endAt: row.end_at ? row.end_at.toISOString() : null,
    isActive: row.is_active === 1,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllPromotions(): Promise<Promotion[]> {
  const [rows] = await db.execute<PromotionRow[]>(
    `SELECT id, code, name, discount_type, discount_value,
            start_at, end_at, is_active, created_at, updated_at
     FROM promotions
     ORDER BY created_at DESC`
  );
  return rows.map(mapPromotion);
}

export async function findPromotionById(id: string): Promise<Promotion | null> {
  const [rows] = await db.execute<PromotionRow[]>(
    `SELECT id, code, name, discount_type, discount_value,
            start_at, end_at, is_active, created_at, updated_at
     FROM promotions WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? mapPromotion(rows[0]) : null;
}

export async function findPromotionByCode(
  code: string,
  excludeId?: string
): Promise<Promotion | null> {
  const sql = excludeId
    ? `SELECT id FROM promotions WHERE code = ? AND id != ? LIMIT 1`
    : `SELECT id FROM promotions WHERE code = ? LIMIT 1`;
  const params = excludeId ? [code, excludeId] : [code];
  const [rows] = await db.execute<RowDataPacket[]>(sql, params);
  if (!rows[0]) return null;
  return findPromotionById((rows[0] as { id: string }).id);
}

export type CreatePromotionData = {
  code: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startAt: string | null;
  endAt: string | null;
};

export async function createPromotion(
  data: CreatePromotionData
): Promise<Promotion> {
  const id = randomUUID();
  await db.execute<ResultSetHeader>(
    `INSERT INTO promotions (id, code, name, discount_type, discount_value, start_at, end_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      data.code,
      data.name,
      data.discountType,
      data.discountValue,
      data.startAt ?? null,
      data.endAt ?? null,
    ]
  );
  const created = await findPromotionById(id);
  if (!created) throw new Error("Create promotion failed");
  return created;
}

export type UpdatePromotionData = CreatePromotionData & { isActive?: boolean };

export async function updatePromotion(
  id: string,
  data: UpdatePromotionData
): Promise<Promotion | null> {
  const isActiveValue = data.isActive === false ? 0 : 1;
  await db.execute<ResultSetHeader>(
    `UPDATE promotions
     SET code = ?, name = ?, discount_type = ?, discount_value = ?,
         start_at = ?, end_at = ?, is_active = ?
     WHERE id = ?`,
    [
      data.code,
      data.name,
      data.discountType,
      data.discountValue,
      data.startAt ?? null,
      data.endAt ?? null,
      isActiveValue,
      id,
    ]
  );
  return findPromotionById(id);
}

export async function togglePromotion(
  id: string,
  isActive: boolean
): Promise<Promotion | null> {
  await db.execute<ResultSetHeader>(
    `UPDATE promotions SET is_active = ? WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
  return findPromotionById(id);
}

export async function deletePromotion(id: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `DELETE FROM promotions WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}
