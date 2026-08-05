import { randomUUID } from "crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type {
  ComboItem,
  ModifierOption,
  ProductConfiguration,
  ProductVariant,
  SaveProductConfigurationBody,
} from "../types/product-configuration.types";
import { ApiError } from "../utils/apiError";

type VariantRow = RowDataPacket & {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  sale_price: string;
  is_default: number;
  is_active: number;
};
type ModifierRow = RowDataPacket & {
  id: string;
  name: string;
  price_delta: string;
  is_active: number;
};
type RecipeRow = RowDataPacket & {
  owner_id: string;
  raw_material_id: string;
  raw_material_name: string;
  unit: string;
  quantity: string;
};
type ProductConfigRow = RowDataPacket & {
  id: string;
  product_type: "single" | "combo";
};
type ComboItemRow = RowDataPacket & {
  id: string;
  component_product_id: string;
  component_product_name: string;
  component_variant_id: string;
  component_variant_name: string;
  quantity: number;
};

async function loadConfiguration(
  executor: Pick<PoolConnection, "execute"> | typeof db,
  productId: string
): Promise<ProductConfiguration | null> {
  const [products] = await executor.execute<ProductConfigRow[]>(
    "SELECT id, product_type FROM products WHERE id = ? LIMIT 1",
    [productId]
  );
  if (!products[0]) return null;

  const [variants] = await executor.execute<VariantRow[]>(
    `SELECT id, product_id, name, sku, sale_price, is_default, is_active
     FROM product_variants WHERE product_id = ?
     ORDER BY is_default DESC, name ASC`,
    [productId]
  );
  const variantIds = variants.map((item) => item.id);
  let variantRecipes: RecipeRow[] = [];
  if (variantIds.length) {
    const placeholders = variantIds.map(() => "?").join(",");
    [variantRecipes] = await executor.execute<RecipeRow[]>(
      `SELECT vri.variant_id AS owner_id, vri.raw_material_id,
              rm.name AS raw_material_name, rm.unit, vri.quantity
       FROM variant_recipe_items vri
       JOIN raw_materials rm ON rm.id = vri.raw_material_id
       WHERE vri.variant_id IN (${placeholders}) ORDER BY rm.name`,
      variantIds
    );
  }

  const [modifiers] = await executor.execute<ModifierRow[]>(
    `SELECT mo.id, mo.name, mo.price_delta, mo.is_active
     FROM product_modifier_options pmo
     JOIN modifier_options mo ON mo.id = pmo.modifier_option_id
     WHERE pmo.product_id = ? ORDER BY mo.name`,
    [productId]
  );
  const modifierIds = modifiers.map((item) => item.id);
  let modifierRecipes: RecipeRow[] = [];
  if (modifierIds.length) {
    const placeholders = modifierIds.map(() => "?").join(",");
    [modifierRecipes] = await executor.execute<RecipeRow[]>(
      `SELECT mri.modifier_option_id AS owner_id, mri.raw_material_id,
              rm.name AS raw_material_name, rm.unit, mri.quantity
       FROM modifier_recipe_items mri
       JOIN raw_materials rm ON rm.id = mri.raw_material_id
       WHERE mri.modifier_option_id IN (${placeholders}) ORDER BY rm.name`,
      modifierIds
    );
  }

  const [comboItems] = await executor.execute<ComboItemRow[]>(
    `SELECT ci.id, ci.component_product_id, p.name AS component_product_name,
            ci.component_variant_id, pv.name AS component_variant_name, ci.quantity
     FROM combo_items ci
     JOIN products p ON p.id = ci.component_product_id
     JOIN product_variants pv ON pv.id = ci.component_variant_id
     WHERE ci.combo_product_id = ?
     ORDER BY p.name, pv.name`,
    [productId]
  );

  const mapRecipe = (rows: RecipeRow[], ownerId: string) =>
    rows.filter((row) => row.owner_id === ownerId).map((row) => ({
      rawMaterialId: row.raw_material_id,
      rawMaterialName: row.raw_material_name,
      unit: row.unit,
      quantity: Number(row.quantity),
    }));

  return {
    productId,
    productType: products[0].product_type,
    variants: variants.map<ProductVariant>((row) => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      sku: row.sku,
      salePrice: Number(row.sale_price),
      isDefault: Boolean(row.is_default),
      isActive: Boolean(row.is_active),
      recipeItems: mapRecipe(variantRecipes, row.id),
    })),
    modifierOptions: modifiers.map<ModifierOption>((row) => ({
      id: row.id,
      name: row.name,
      priceDelta: Number(row.price_delta),
      isActive: Boolean(row.is_active),
      recipeItems: mapRecipe(modifierRecipes, row.id),
    })),
    comboItems: comboItems.map<ComboItem>((row) => ({
      id: row.id,
      componentProductId: row.component_product_id,
      componentProductName: row.component_product_name,
      componentVariantId: row.component_variant_id,
      componentVariantName: row.component_variant_name,
      quantity: Number(row.quantity),
    })),
  };
}

export function findProductConfiguration(productId: string) {
  return loadConfiguration(db, productId);
}

export async function saveProductConfiguration(
  productId: string,
  body: SaveProductConfigurationBody
) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [products] = await connection.execute<(RowDataPacket & { id: string })[]>(
      "SELECT id FROM products WHERE id = ? FOR UPDATE",
      [productId]
    );
    if (!products[0]) throw new ApiError(404, "Không tìm thấy sản phẩm.");

    const productType = body.productType === "combo" ? "combo" : "single";

    const [currentLinks] = await connection.execute<
      (RowDataPacket & { modifier_option_id: string })[]
    >(
      "SELECT modifier_option_id FROM product_modifier_options WHERE product_id = ? FOR UPDATE",
      [productId]
    );
    const currentModifierIds = new Set(currentLinks.map((item) => item.modifier_option_id));
    await connection.execute(
      "UPDATE product_variants SET is_active = 0, is_default = 0 WHERE product_id = ?",
      [productId]
    );

    for (const variant of body.variants) {
      const id = variant.id || randomUUID();
      const [existing] = await connection.execute<(RowDataPacket & { product_id: string })[]>(
        "SELECT product_id FROM product_variants WHERE id = ? FOR UPDATE",
        [id]
      );
      if (existing[0] && existing[0].product_id !== productId) {
        throw new ApiError(409, "Biến thể không thuộc sản phẩm đang cấu hình.");
      }
      await connection.execute(
        `INSERT INTO product_variants
          (id, product_id, name, sku, sale_price, is_default, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), sku = VALUES(sku),
           sale_price = VALUES(sale_price), is_default = VALUES(is_default),
           is_active = VALUES(is_active)`,
        [id, productId, variant.name, variant.sku || null, variant.salePrice,
          variant.isDefault ? 1 : 0, variant.isActive === false ? 0 : 1]
      );
      await connection.execute("DELETE FROM variant_recipe_items WHERE variant_id = ?", [id]);
      for (const recipe of variant.recipeItems || []) {
        await connection.execute(
          "INSERT INTO variant_recipe_items (id, variant_id, raw_material_id, quantity) VALUES (?, ?, ?, ?)",
          [randomUUID(), id, recipe.rawMaterialId, recipe.quantity]
        );
      }
    }

    const defaultVariant = body.variants.find((item) => item.isDefault) ?? body.variants[0];
    await connection.execute("UPDATE products SET sale_price = ? WHERE id = ?", [
      defaultVariant.salePrice,
      productId,
    ]);

    await connection.execute(
      "UPDATE products SET product_type = ? WHERE id = ?",
      [productType, productId]
    );
    await connection.execute("DELETE FROM combo_items WHERE combo_product_id = ?", [productId]);
    if (productType === "combo") {
      for (const comboItem of body.comboItems || []) {
        const [components] = await connection.execute<
          (RowDataPacket & { id: string; product_type: string; variant_id: string | null })[]
        >(
          `SELECT p.id, p.product_type, pv.id AS variant_id
           FROM products p
           LEFT JOIN product_variants pv
             ON pv.id = ? AND pv.product_id = p.id AND pv.is_active = 1
           WHERE p.id = ? LIMIT 1 FOR UPDATE`,
          [comboItem.componentVariantId, comboItem.componentProductId]
        );
        const component = components[0];
        if (!component || !component.variant_id || component.product_type === "combo") {
          throw new ApiError(400, "Món thành phần hoặc biến thể cố định của combo không hợp lệ.");
        }
        await connection.execute(
          `INSERT INTO combo_items
            (id, combo_product_id, component_product_id, component_variant_id, quantity)
           VALUES (?, ?, ?, ?, ?)`,
          [comboItem.id || randomUUID(), productId, comboItem.componentProductId,
            comboItem.componentVariantId, comboItem.quantity]
        );
      }
    }

    await connection.execute("DELETE FROM product_modifier_options WHERE product_id = ?", [productId]);
    for (const modifier of productType === "combo" ? [] : body.modifierOptions || []) {
      const id = modifier.id || randomUUID();
      const [existing] = await connection.execute<(RowDataPacket & { id: string })[]>(
        "SELECT id FROM modifier_options WHERE id = ? FOR UPDATE",
        [id]
      );
      if (existing[0] && !currentModifierIds.has(id)) {
        throw new ApiError(409, "Topping không thuộc sản phẩm đang cấu hình.");
      }
      await connection.execute(
        `INSERT INTO modifier_options (id, name, price_delta, is_active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), price_delta = VALUES(price_delta),
           is_active = VALUES(is_active)`,
        [id, modifier.name, modifier.priceDelta, modifier.isActive === false ? 0 : 1]
      );
      await connection.execute(
        "INSERT INTO product_modifier_options (product_id, modifier_option_id) VALUES (?, ?)",
        [productId, id]
      );
      await connection.execute("DELETE FROM modifier_recipe_items WHERE modifier_option_id = ?", [id]);
      for (const recipe of modifier.recipeItems || []) {
        await connection.execute(
          "INSERT INTO modifier_recipe_items (id, modifier_option_id, raw_material_id, quantity) VALUES (?, ?, ?, ?)",
          [randomUUID(), id, recipe.rawMaterialId, recipe.quantity]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findProductConfiguration(productId);
}
