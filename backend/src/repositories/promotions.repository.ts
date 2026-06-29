import { randomUUID } from "crypto";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "../config/database";

export type Promotion = {
  id: string;
  promotionScope: "product" | "combo";
  productId: string | null;
  productName: string;
  requiredItems: PromotionRequiredItem[];
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

export type PromotionRequiredItem = {
  productId: string;
  productName: string;
  quantity: number;
};

type PromotionRow = RowDataPacket & {
  id: string;
  product_id: string;
  product_name: string;
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

type ComboPromotionRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  config: unknown;
  is_active: number;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ComboProductRow = RowDataPacket & {
  id: string;
  name: string;
};

export type ValidatedPromotion = {
  id: string;
  code: string;
  name: string;
  productId: string;
  productName: string;
  discountType: "percent" | "fixed";
  discountValue: number;
};

export type PromotionRuleType =
  | "combo_fixed"
  | "time_window"
  | "invoice_threshold"
  | "code"
  | "bundle_special_price"
  | "day_of_week";

type PromotionRuleRow = RowDataPacket & {
  id: string;
  code: string | null;
  name: string;
  rule_type: PromotionRuleType;
  discount_type: "percent" | "fixed" | "special_price" | "buy_x_get_y";
  discount_value: string;
  min_order_amount: string | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: string | null;
  priority: number;
  config: unknown;
};

type PromotionRuleConfig = {
  requiredItems?: Array<{
    productId?: string;
    productName?: string;
    quantity?: number;
  }>;
  requiredProductIds?: string[];
  requiredProductNameIncludes?: string[];
  productIds?: string[];
  productNameIncludes?: string[];
  categoryIds?: string[];
  categoryNameIncludes?: string[];
  discountedProductId?: string;
  discountedProductNameIncludes?: string[];
  specialPrice?: number;
  buyQuantity?: number;
  getQuantity?: number;
};

type NormalizedRequiredItem = {
  productId: string;
  productName?: string;
  quantity: number;
};

export type PosPromotionLine = {
  productId: string;
  productName: string;
  categoryId?: string | null;
  categoryName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type AppliedPosPromotion = {
  id: string;
  code: string | null;
  name: string;
  ruleType: PromotionRuleType | "product_code";
  discountAmount: number;
  priority: number;
};

function mapPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    promotionScope: "product",
    productId: row.product_id,
    productName: row.product_name,
    requiredItems: [],
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

function normalizeRequiredItems(config: PromotionRuleConfig): NormalizedRequiredItem[] {
  if (config.requiredItems?.length) {
    const normalized = config.requiredItems
      .map((item) => ({
        productId: String(item.productId ?? "").trim(),
        productName: String(item.productName ?? "").trim() || undefined,
        quantity: Math.max(1, Number(item.quantity ?? 1)),
      }))
      .filter((item) => item.productId);

    if (normalized.length > 0) return normalized;
  }

  return (config.requiredProductIds ?? [])
    .map((productId) => ({
      productId: String(productId).trim(),
      quantity: 1,
    }))
    .filter((item) => item.productId);
}

async function attachComboItems(
  rows: ComboPromotionRow[]
): Promise<Promotion[]> {
  const parsed = rows.map((row) => ({
    row,
    requiredItems: normalizeRequiredItems(parseRuleConfig(row.config)),
  }));

  const productIds = Array.from(
    new Set(
      parsed.flatMap((item) =>
        item.requiredItems.map((requiredItem) => requiredItem.productId)
      )
    )
  );

  const productNameMap = new Map<string, string>();
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => "?").join(", ");
    const [products] = await db.execute<ComboProductRow[]>(
      `SELECT id, name FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    for (const product of products) {
      productNameMap.set(product.id, product.name);
    }
  }

  return parsed.map(({ row, requiredItems }) => {
    const enrichedItems = requiredItems.map((item) => ({
      ...item,
      productName: productNameMap.get(item.productId) ?? "Sản phẩm",
    }));

    return {
      id: row.id,
      promotionScope: "combo",
      productId: null,
      productName: enrichedItems.map((item) => item.productName).join(" + "),
      requiredItems: enrichedItems,
      code: row.code,
      name: row.name,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      startAt: row.starts_at ? row.starts_at.toISOString() : null,
      endAt: row.ends_at ? row.ends_at.toISOString() : null,
      isActive: row.is_active === 1,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  });
}

const promotionSelect = `
  SELECT
    promotions.id,
    promotions.product_id,
    products.name AS product_name,
    promotions.code,
    promotions.name,
    promotions.discount_type,
    promotions.discount_value,
    promotions.start_at,
    promotions.end_at,
    promotions.is_active,
    promotions.created_at,
    promotions.updated_at
  FROM promotions
  JOIN products ON products.id = promotions.product_id
`;

export async function findAllPromotions(): Promise<Promotion[]> {
  const [rows] = await db.execute<PromotionRow[]>(
    `${promotionSelect} ORDER BY promotions.created_at DESC`
  );
  const [comboRows] = await db.execute<ComboPromotionRow[]>(
    `
    SELECT
      id,
      code,
      name,
      discount_type,
      discount_value,
      config,
      is_active,
      starts_at,
      ends_at,
      created_at,
      updated_at
    FROM promotion_rules
    WHERE rule_type = 'combo_fixed'
      AND code IS NOT NULL
    ORDER BY created_at DESC
    `
  );

  const productPromotions = rows.map(mapPromotion);
  const comboPromotions = await attachComboItems(comboRows);

  return [...productPromotions, ...comboPromotions].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export async function findPromotionById(id: string): Promise<Promotion | null> {
  const [rows] = await db.execute<PromotionRow[]>(
    `${promotionSelect} WHERE promotions.id = ? LIMIT 1`,
    [id]
  );
  if (rows[0]) return mapPromotion(rows[0]);

  const [comboRows] = await db.execute<ComboPromotionRow[]>(
    `
    SELECT
      id,
      code,
      name,
      discount_type,
      discount_value,
      config,
      is_active,
      starts_at,
      ends_at,
      created_at,
      updated_at
    FROM promotion_rules
    WHERE id = ?
      AND rule_type = 'combo_fixed'
      AND code IS NOT NULL
    LIMIT 1
    `,
    [id]
  );

  if (!comboRows[0]) return null;
  const comboPromotions = await attachComboItems(comboRows);
  return comboPromotions[0] ?? null;
}

export async function findPromotionByCode(
  code: string,
  excludeId?: string
): Promise<Promotion | null> {
  const normalizedCode = code.trim().toUpperCase();
  const sql = excludeId
    ? `SELECT id FROM promotions WHERE code = ? AND id != ? LIMIT 1`
    : `SELECT id FROM promotions WHERE code = ? LIMIT 1`;
  const params = excludeId ? [normalizedCode, excludeId] : [normalizedCode];
  const [rows] = await db.execute<RowDataPacket[]>(sql, params);
  if (rows[0]) return findPromotionById((rows[0] as { id: string }).id);

  const comboSql = excludeId
    ? `SELECT id FROM promotion_rules WHERE code = ? AND id != ? LIMIT 1`
    : `SELECT id FROM promotion_rules WHERE code = ? LIMIT 1`;
  const [comboRows] = await db.execute<RowDataPacket[]>(comboSql, params);
  if (!comboRows[0]) return null;
  return findPromotionById((comboRows[0] as { id: string }).id);
}

export type CreatePromotionData = {
  promotionScope: "product" | "combo";
  productId: string | null;
  requiredItems: Array<{ productId: string; quantity: number }>;
  code: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startAt: string | null;
  endAt: string | null;
};

async function buildComboRuleConfig(
  requiredItems: Array<{ productId: string; quantity: number }>
) {
  const productIds = requiredItems.map((item) => item.productId);
  const productNameMap = new Map<string, string>();

  if (productIds.length > 0) {
    const placeholders = productIds.map(() => "?").join(", ");
    const [products] = await db.execute<ComboProductRow[]>(
      `SELECT id, name FROM products WHERE id IN (${placeholders})`,
      productIds
    );

    for (const product of products) {
      productNameMap.set(product.id, product.name);
    }
  }

  const enrichedItems = requiredItems.map((item) => ({
    ...item,
    productName: productNameMap.get(item.productId) ?? "",
  }));

  return {
    requiredItems: enrichedItems,
    requiredProductIds: productIds,
    requiredProductNameIncludes: enrichedItems
      .map((item) => item.productName)
      .filter(Boolean),
  };
}

export async function createPromotion(
  data: CreatePromotionData
): Promise<Promotion> {
  const id = randomUUID();

  if (data.promotionScope === "combo") {
    await db.execute<ResultSetHeader>(
      `INSERT INTO promotion_rules (
         id,
         code,
         name,
         rule_type,
         discount_type,
         discount_value,
         priority,
         config,
         is_active,
         starts_at,
         ends_at
       )
       VALUES (?, ?, ?, 'combo_fixed', ?, ?, 30, ?, 1, ?, ?)`,
      [
        id,
        data.code,
        data.name,
        data.discountType,
        data.discountValue,
        JSON.stringify(await buildComboRuleConfig(data.requiredItems)),
        data.startAt ?? null,
        data.endAt ?? null,
      ]
    );
    const created = await findPromotionById(id);
    if (!created) throw new Error("Create promotion failed");
    return created;
  }

  await db.execute<ResultSetHeader>(
    `INSERT INTO promotions (
       id,
       product_id,
       code,
       name,
       discount_type,
       discount_value,
       start_at,
       end_at,
       is_active
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      data.productId,
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

  if (data.promotionScope === "combo") {
    await db.execute<ResultSetHeader>(
      `UPDATE promotion_rules
       SET code = ?,
           name = ?,
           discount_type = ?,
           discount_value = ?,
           config = ?,
           starts_at = ?,
           ends_at = ?,
           is_active = ?
       WHERE id = ?
         AND rule_type = 'combo_fixed'`,
      [
        data.code,
        data.name,
        data.discountType,
        data.discountValue,
        JSON.stringify(await buildComboRuleConfig(data.requiredItems)),
        data.startAt ?? null,
        data.endAt ?? null,
        isActiveValue,
        id,
      ]
    );
    return findPromotionById(id);
  }

  await db.execute<ResultSetHeader>(
    `UPDATE promotions
     SET product_id = ?,
         code = ?,
         name = ?,
         discount_type = ?,
         discount_value = ?,
         start_at = ?,
         end_at = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.productId,
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
  const [productResult] = await db.execute<ResultSetHeader>(
    `UPDATE promotions SET is_active = ? WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
  if (productResult.affectedRows > 0) return findPromotionById(id);

  await db.execute<ResultSetHeader>(
    `UPDATE promotion_rules SET is_active = ? WHERE id = ? AND rule_type = 'combo_fixed'`,
    [isActive ? 1 : 0, id]
  );
  return findPromotionById(id);
}

export async function deletePromotion(id: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `DELETE FROM promotions WHERE id = ?`,
    [id]
  );
  if (result.affectedRows > 0) return true;

  const [comboResult] = await db.execute<ResultSetHeader>(
    `DELETE FROM promotion_rules WHERE id = ? AND rule_type = 'combo_fixed'`,
    [id]
  );
  return comboResult.affectedRows > 0;
}

export async function findActivePromotionByCode(
  connection: PoolConnection,
  code: string
): Promise<ValidatedPromotion | null> {
  const now = new Date();

  const [rows] = await connection.execute<PromotionRow[]>(
    `
    SELECT
      promotions.id,
      promotions.code,
      promotions.name,
      promotions.product_id,
      products.name AS product_name,
      promotions.discount_type,
      promotions.discount_value
    FROM promotions
    JOIN products ON products.id = promotions.product_id
    WHERE promotions.code = ?
      AND promotions.product_id IS NOT NULL
      AND promotions.is_active = 1
      AND (promotions.start_at IS NULL OR promotions.start_at <= ?)
      AND (promotions.end_at IS NULL OR promotions.end_at > ?)
    LIMIT 1
    `,
    [code.trim().toUpperCase(), now, now]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    productId: row.product_id,
    productName: row.product_name,
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

function parseRuleConfig(value: unknown): PromotionRuleConfig {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as PromotionRuleConfig;
    } catch {
      return {};
    }
  }

  if (typeof value === "object") {
    return value as PromotionRuleConfig;
  }

  return {};
}

function textIncludes(value: string | null | undefined, needles?: string[]) {
  if (!needles?.length) return false;
  const normalized = String(value ?? "").toLocaleLowerCase("vi-VN");
  return needles.some((needle) =>
    normalized.includes(String(needle).toLocaleLowerCase("vi-VN"))
  );
}

function getRequiredProductName(
  item: NormalizedRequiredItem,
  productNameMap?: Map<string, string>
) {
  return item.productName || productNameMap?.get(item.productId) || "";
}

function findLineForRequiredItem(
  lines: PosPromotionLine[],
  item: NormalizedRequiredItem,
  productNameMap?: Map<string, string>
) {
  const lineById = lines.find((line) => line.productId === item.productId);
  if (lineById) return lineById;

  const productName = getRequiredProductName(item, productNameMap);
  if (!productName) return null;

  return (
    lines.find((line) => textIncludes(line.productName, [productName])) ?? null
  );
}

async function buildRequiredProductNameMap(
  connection: PoolConnection,
  rules: PromotionRuleRow[]
) {
  const productIds = Array.from(
    new Set(
      rules.flatMap((rule) =>
        normalizeRequiredItems(parseRuleConfig(rule.config)).map(
          (item) => item.productId
        )
      )
    )
  ).filter(Boolean);

  const productNameMap = new Map<string, string>();
  if (productIds.length === 0) return productNameMap;

  const placeholders = productIds.map(() => "?").join(", ");
  const [products] = await connection.execute<ComboProductRow[]>(
    `SELECT id, name FROM products WHERE id IN (${placeholders})`,
    productIds
  );

  for (const product of products) {
    productNameMap.set(product.id, product.name);
  }

  return productNameMap;
}

function getMatchingLines(
  lines: PosPromotionLine[],
  config: PromotionRuleConfig
) {
  return lines.filter((line) => {
    if (config.productIds?.includes(line.productId)) return true;
    if (config.categoryIds?.includes(line.categoryId ?? "")) return true;
    if (textIncludes(line.productName, config.productNameIncludes)) return true;
    if (textIncludes(line.categoryName, config.categoryNameIncludes)) return true;
    return false;
  });
}

function hasRequiredProducts(
  lines: PosPromotionLine[],
  config: PromotionRuleConfig,
  productNameMap?: Map<string, string>
) {
  const requiredItems = normalizeRequiredItems(config);
  const itemOk =
    requiredItems.length === 0 ||
    requiredItems.every((item) => {
      const line = findLineForRequiredItem(lines, item, productNameMap);
      return (line?.quantity ?? 0) >= item.quantity;
    });

  const idsOk =
    !config.requiredProductIds?.length ||
    config.requiredProductIds.every((productId) =>
      lines.some((line) => line.productId === productId && line.quantity > 0)
    );

  const namesOk =
    !config.requiredProductNameIncludes?.length ||
    config.requiredProductNameIncludes.every((needle) =>
      lines.some(
        (line) => textIncludes(line.productName, [needle]) && line.quantity > 0
      )
    );

  return itemOk && idsOk && namesOk;
}

function countComboSets(
  lines: PosPromotionLine[],
  config: PromotionRuleConfig,
  productNameMap?: Map<string, string>
) {
  const requiredItems = normalizeRequiredItems(config);
  if (requiredItems.length > 0) {
    const setCounts = requiredItems.map((item) => {
      const line = findLineForRequiredItem(lines, item, productNameMap);
      return Math.floor((line?.quantity ?? 0) / item.quantity);
    });
    return Math.min(...setCounts);
  }

  if (config.requiredProductIds?.length) {
    const quantities = config.requiredProductIds.map((productId) => {
      const line = lines.find((item) => item.productId === productId);
      return line?.quantity ?? 0;
    });
    return Math.min(...quantities);
  }

  if (config.requiredProductNameIncludes?.length) {
    const quantities = config.requiredProductNameIncludes.map((needle) => {
      const line = lines.find((item) => textIncludes(item.productName, [needle]));
      return line?.quantity ?? 0;
    });
    return Math.min(...quantities);
  }

  return 0;
}

function isRuleInTime(row: PromotionRuleRow, now: Date) {
  if (row.days_of_week) {
    const allowedDays = row.days_of_week
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item));

    if (allowedDays.length > 0 && !allowedDays.includes(now.getDay())) {
      return false;
    }
  }

  if (!row.start_time && !row.end_time) return true;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const start = row.start_time ? toMinutes(row.start_time) : 0;
  const end = row.end_time ? toMinutes(row.end_time) : 24 * 60 - 1;

  if (start <= end) {
    return currentMinutes >= start && currentMinutes <= end;
  }

  return currentMinutes >= start || currentMinutes <= end;
}

function calculateRuleDiscount(
  row: PromotionRuleRow,
  lines: PosPromotionLine[],
  totalAmount: number,
  promotionCode: string | null,
  productNameMap?: Map<string, string>
) {
  const config = parseRuleConfig(row.config);
  const discountValue = Number(row.discount_value);

  if (row.code && row.code.toUpperCase() !== promotionCode?.toUpperCase()) {
    return 0;
  }

  if (row.rule_type === "code") {
    if (!row.code || row.code.toUpperCase() !== promotionCode?.toUpperCase()) {
      return 0;
    }

    if (row.discount_type === "percent") {
      return (totalAmount * discountValue) / 100;
    }

    return Math.min(discountValue, totalAmount);
  }

  if (row.rule_type === "invoice_threshold") {
    const minOrderAmount = Number(row.min_order_amount ?? 0);
    if (totalAmount < minOrderAmount) return 0;

    if (row.discount_type === "percent") {
      return (totalAmount * discountValue) / 100;
    }

    return Math.min(discountValue, totalAmount);
  }

  if (row.rule_type === "combo_fixed") {
    const comboSets = countComboSets(lines, config, productNameMap);
    if (comboSets <= 0) return 0;

    if (row.discount_type === "percent") {
      return (totalAmount * discountValue) / 100;
    }

    return Math.min(discountValue * comboSets, totalAmount);
  }

  if (row.rule_type === "time_window" || row.rule_type === "day_of_week") {
    const matchedLines = getMatchingLines(lines, config);
    if (matchedLines.length === 0) return 0;

    const eligibleSubtotal = matchedLines.reduce(
      (total, line) => total + line.lineTotal,
      0
    );

    if (row.discount_type === "buy_x_get_y") {
      const buyQuantity = Math.max(1, Number(config.buyQuantity ?? 2));
      const getQuantity = Math.max(1, Number(config.getQuantity ?? 1));
      const groupSize = buyQuantity + getQuantity;
      return matchedLines.reduce((total, line) => {
        const freeQuantity = Math.floor(line.quantity / groupSize) * getQuantity;
        return total + freeQuantity * line.unitPrice;
      }, 0);
    }

    if (row.discount_type === "percent") {
      return (eligibleSubtotal * discountValue) / 100;
    }

    return Math.min(discountValue, eligibleSubtotal);
  }

  if (row.rule_type === "bundle_special_price") {
    if (!hasRequiredProducts(lines, config, productNameMap)) return 0;

    const discountedLines = lines.filter((line) => {
      if (config.discountedProductId && line.productId === config.discountedProductId) {
        return true;
      }
      return textIncludes(line.productName, config.discountedProductNameIncludes);
    });

    const specialPrice = Number(config.specialPrice ?? discountValue);
    return discountedLines.reduce((total, line) => {
      const perItemDiscount = Math.max(0, line.unitPrice - specialPrice);
      return total + perItemDiscount * line.quantity;
    }, 0);
  }

  return 0;
}

export async function findActivePromotionRules(
  connection: PoolConnection
): Promise<PromotionRuleRow[]> {
  const now = new Date();
  let rows: PromotionRuleRow[] = [];

  try {
    const [result] = await connection.execute<PromotionRuleRow[]>(
      `
      SELECT
        id,
        code,
        name,
        rule_type,
        discount_type,
        discount_value,
        min_order_amount,
        start_time,
        end_time,
        days_of_week,
        priority,
        config
      FROM promotion_rules
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at > ?)
      `,
      [now, now]
    );
    rows = result;
  } catch (error) {
    if ((error as { code?: string }).code === "ER_NO_SUCH_TABLE") {
      return [];
    }
    throw error;
  }

  return rows.filter((row) => isRuleInTime(row, now));
}

export async function getPromotionCodeFailureMessage(
  connection: PoolConnection,
  lines: PosPromotionLine[],
  code: string
): Promise<string | null> {
  const now = new Date();
  const [rows] = await connection.execute<ComboPromotionRow[]>(
    `
    SELECT
      id,
      code,
      name,
      discount_type,
      discount_value,
      config,
      is_active,
      starts_at,
      ends_at,
      created_at,
      updated_at
    FROM promotion_rules
    WHERE code = ?
      AND rule_type = 'combo_fixed'
      AND is_active = 1
      AND (starts_at IS NULL OR starts_at <= ?)
      AND (ends_at IS NULL OR ends_at > ?)
    LIMIT 1
    `,
    [code.trim().toUpperCase(), now, now]
  );

  const rule = rows[0];
  if (!rule) return null;

  const requiredItems = normalizeRequiredItems(parseRuleConfig(rule.config));
  if (requiredItems.length === 0) return null;

  const productIds = requiredItems.map((item) => item.productId);
  const placeholders = productIds.map(() => "?").join(", ");
  const [products] = await connection.execute<ComboProductRow[]>(
    `SELECT id, name FROM products WHERE id IN (${placeholders})`,
    productIds
  );
  const productNameMap = new Map(products.map((item) => [item.id, item.name]));

  const missingItems = requiredItems
    .map((item) => {
      const line = findLineForRequiredItem(lines, item, productNameMap);
      const missingQuantity = item.quantity - (line?.quantity ?? 0);
      return {
        productName: getRequiredProductName(item, productNameMap) || "Sản phẩm",
        missingQuantity,
      };
    })
    .filter((item) => item.missingQuantity > 0);

  if (missingItems.length === 0) return null;

  const missingText = missingItems
    .map((item) => `${item.productName} x${item.missingQuantity}`)
    .join(", ");

  return `Mã "${rule.code}" là mã combo. Vui lòng thêm ${missingText} để áp dụng khuyến mãi.`;
}

function chooseBetterPromotion(
  current: AppliedPosPromotion | null,
  candidate: AppliedPosPromotion
) {
  if (!current) return candidate;
  if (candidate.discountAmount > current.discountAmount) return candidate;
  if (
    candidate.discountAmount === current.discountAmount &&
    candidate.priority < current.priority
  ) {
    return candidate;
  }
  return current;
}

export async function calculateBestPosPromotion(
  connection: PoolConnection,
  lines: PosPromotionLine[],
  totalAmount: number,
  promotionCode?: string | null
): Promise<AppliedPosPromotion | null> {
  let bestPromotion: AppliedPosPromotion | null = null;
  const normalizedCode = promotionCode?.trim() || null;
  const rules = await findActivePromotionRules(connection);
  const requiredProductNameMap = await buildRequiredProductNameMap(
    connection,
    rules
  );
  const hasCodeRule = Boolean(
    normalizedCode &&
      rules.some(
        (rule) => rule.code?.toUpperCase() === normalizedCode.toUpperCase()
      )
  );

  if (normalizedCode && !hasCodeRule) {
    const productPromotion = await findActivePromotionByCode(
      connection,
      normalizedCode
    );

    if (productPromotion) {
      const eligibleSubtotal = lines
        .filter((line) => line.productId === productPromotion.productId)
        .reduce((total, line) => total + line.lineTotal, 0);

      if (eligibleSubtotal > 0) {
        bestPromotion = chooseBetterPromotion(bestPromotion, {
          id: productPromotion.id,
          code: productPromotion.code,
          name: productPromotion.name,
          ruleType: "product_code",
          discountAmount: Math.round(
            calculateDiscount(eligibleSubtotal, productPromotion)
          ),
          priority: 30,
        });
      }
    }
  }

  for (const rule of rules) {
    const discountAmount = Math.round(
      Math.min(
        calculateRuleDiscount(
          rule,
          lines,
          totalAmount,
          normalizedCode,
          requiredProductNameMap
        ),
        totalAmount
      )
    );

    if (discountAmount <= 0) continue;

    bestPromotion = chooseBetterPromotion(bestPromotion, {
      id: rule.id,
      code: rule.code,
      name: rule.name,
      ruleType: rule.rule_type,
      discountAmount,
      priority: rule.priority,
    });
  }

  return bestPromotion;
}
