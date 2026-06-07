import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { db } from "../config/database";
import type { Category } from "../types/category.types";

type CategoryRow = RowDataPacket & {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_count: number | string;
  is_active: number;
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
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllCategories(): Promise<Category[]> {
  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT
      c.id,
      c.name,
      c.description,
      c.image_url,
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
      c.created_at,
      c.updated_at
    ORDER BY c.created_at DESC
    `
  );

  return rows.map(mapCategory);
}

export async function findCategoryById(id: string): Promise<Category | null> {
  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT
      c.id,
      c.name,
      c.description,
      c.image_url,
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
  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT id, name, description, image_url, is_active, created_at, updated_at, 0 AS product_count
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
}): Promise<Category> {
  const id = randomUUID();

  const [result] = await db.execute<ResultSetHeader>(
    `
    INSERT INTO categories (id, name, description, image_url)
    VALUES (?, ?, ?, ?)
    `,
    [id, data.name, data.description, data.imageUrl]
  );

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
  }
): Promise<Category | null> {
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
