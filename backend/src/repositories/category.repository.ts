import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { db } from "../config/database";
import type { Category } from "../types/category.types";

type CategoryRow = RowDataPacket & {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllCategories(): Promise<Category[]> {
  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT id, name, description, is_active, created_at, updated_at
    FROM categories
    ORDER BY created_at DESC
    `
  );

  return rows.map(mapCategory);
}

export async function findCategoryById(id: string): Promise<Category | null> {
  const [rows] = await db.execute<CategoryRow[]>(
    `
    SELECT id, name, description, is_active, created_at, updated_at
    FROM categories
    WHERE id = ?
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
    SELECT id, name, description, is_active, created_at, updated_at
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
}): Promise<Category> {
  const id = randomUUID();

  const [result] = await db.execute<ResultSetHeader>(
    `
    INSERT INTO categories (id, name, description)
    VALUES (?, ?, ?)
    `,
    [id, data.name, data.description]
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
  }
): Promise<Category | null> {
  await db.execute<ResultSetHeader>(
    `
    UPDATE categories
    SET name = ?, description = ?
    WHERE id = ?
    `,
    [data.name, data.description, id]
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
