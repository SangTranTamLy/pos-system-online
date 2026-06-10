import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { db } from "../config/database";
import type { Category } from "../types/category.types";

let _hasCategoryFlags: boolean | null = null;

async function hasCategoryFlags(): Promise<boolean> {
  if (_hasCategoryFlags !== null) return _hasCategoryFlags;

  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'categories'
      AND COLUMN_NAME IN ('requires_preparation', 'is_stock_returnable')
    `
  );

  const cnt = Number((rows as any)[0]?.cnt ?? 0);
  _hasCategoryFlags = cnt === 2;
  return _hasCategoryFlags;
}

type CategoryRow = RowDataPacket & {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_count: number | string;
  is_active: number;
  requires_preparation: number;
  is_stock_returnable: number;
  created_at: Date;
  updated_at: Date;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    productCount: Number(row.product_count ?? 0),
    isActive: Boolean(row.is_active),
    requiresPreparation: Boolean(row.requires_preparation),
    isStockReturnable: Boolean(row.is_stock_returnable),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllCategories(): Promise<Category[]> {
  const flags = await hasCategoryFlags();

  const selectFlags = flags
    ? "c.requires_preparation, c.is_stock_returnable,"
    : "0 AS requires_preparation, 0 AS is_stock_returnable,";

  const groupByFlags = flags ? "c.requires_preparation, c.is_stock_returnable," : "";

  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT
      c.id,
      c.name,
      c.description,
      c.image_url,
      ${selectFlags}
      c.is_active,
      c.created_at,
      c.updated_at,
      COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY
      c.id,
      c.name,
      c.description,
      c.image_url,
      c.is_active,
      ${groupByFlags}
      c.created_at,
      c.updated_at
    ORDER BY c.created_at DESC
    `
  );

  return rows.map(mapCategory);
}

export async function findCategoryById(id: string): Promise<Category | null> {
  const flags = await hasCategoryFlags();

  const selectFlags = flags
    ? "c.requires_preparation, c.is_stock_returnable,"
    : "0 AS requires_preparation, 0 AS is_stock_returnable,";

  const groupByFlags = flags ? "c.requires_preparation, c.is_stock_returnable," : "";

  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT
      c.id,
      c.name,
      c.description,
      c.image_url,
      ${selectFlags}
      c.is_active,
      c.created_at,
      c.updated_at,
      COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.id = ?
    GROUP BY
      c.id,
      c.name,
      c.description,
      c.image_url,
      c.is_active,
      ${groupByFlags}
      c.created_at,
      c.updated_at
    LIMIT 1
    `,
    [id]
  );

  const category = rows[0];

  if (!category) {
    return null;
  }

  return mapCategory(category);
}

export async function findCategoryByName(name: string): Promise<Category | null> {
  const flags = await hasCategoryFlags();

  const selectFlags = flags
    ? "requires_preparation, is_stock_returnable,"
    : "0 AS requires_preparation, 0 AS is_stock_returnable,";

  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT id, name, description, image_url, ${selectFlags} is_active, created_at, updated_at, 0 AS product_count
    FROM categories
    WHERE name = ?
    LIMIT 1
    `,
    [name]
  );

  const category = rows[0];

  if (!category) {
    return null;
  }

  return mapCategory(category);
}

export async function createCategory(data: {
  name: string;
  description: string | null;
  imageUrl: string | null;
  requiresPreparation?: boolean;
  isStockReturnable?: boolean;
}): Promise<Category> {
  const id = randomUUID();

  const flags = await hasCategoryFlags();

  let result;

  if (flags) {
    [result] = await db.execute<ResultSetHeader>(
      `
      INSERT INTO categories (id, name, description, image_url, requires_preparation, is_stock_returnable)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, data.name, data.description, data.imageUrl, data.requiresPreparation ? 1 : 0, data.isStockReturnable ? 1 : 0]
    );
  } else {
    [result] = await db.execute<ResultSetHeader>(
      `
      INSERT INTO categories (id, name, description, image_url)
      VALUES (?, ?, ?, ?)
      `,
      [id, data.name, data.description, data.imageUrl]
    );
  }

  if (result.affectedRows === 0) {
    throw new Error("Create category failed");
  }

  const category = await findCategoryById(id);

  if (!category) {
    throw new Error("Create category failed");
  }

  return category;
}

export async function updateCategory(
  id: string,
  data: {
    name: string;
    description: string | null;
    imageUrl: string | null;
    requiresPreparation?: boolean;
    isStockReturnable?: boolean;
  }
): Promise<Category | null> {
  const flags = await hasCategoryFlags();

  if (!flags) {
    // If DB doesn't have flag columns, update only name/description/image
    await db.execute<ResultSetHeader>(
      `
      UPDATE categories
      SET name = ?, description = ?, image_url = ?
      WHERE id = ?
      `,
      [data.name, data.description, data.imageUrl, id]
    );

    return findCategoryById(id);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute<ResultSetHeader>(
      `
      UPDATE categories
      SET name = ?, description = ?, image_url = ?, requires_preparation = ?, is_stock_returnable = ?
      WHERE id = ?
      `,
      [
        data.name,
        data.description,
        data.imageUrl,
        data.requiresPreparation ? 1 : 0,
        data.isStockReturnable ? 1 : 0,
        id,
      ]
    );

    await conn.execute<ResultSetHeader>(
      `
      UPDATE products
      SET requires_preparation = ?, is_stock_returnable = ?
      WHERE category_id = ?
      `,
      [data.requiresPreparation ? 1 : 0, data.isStockReturnable ? 1 : 0, id]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return findCategoryById(id);
}

export async function updateCategoryStatus(
  id: string,
  isActive: boolean
): Promise<Category | null> {
  await db.execute<ResultSetHeader>(
    `
    UPDATE categories
    SET is_active = ?
    WHERE id = ?
    `,
    [isActive, id]
  );

  return findCategoryById(id);
}

export async function countProductsByCategoryId(id: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { total: number })[]>(
    `
    SELECT COUNT(*) AS total
    FROM products
    WHERE category_id = ?
    `,
    [id]
  );

  return rows[0]?.total ?? 0;
}

export async function deleteCategoryById(id: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `
    DELETE FROM categories
    WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows > 0;
}
