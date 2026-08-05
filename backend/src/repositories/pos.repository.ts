import { randomUUID } from "crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type {
  NormalizedPosOrderItem,
  PosOrderDetail,
  PosOrderResult,
  PosPaymentMethod,
} from "../types/pos.types";
import { ApiError } from "../utils/apiError";
import {
  calculateBestPosPromotion,
  getPromotionCodeFailureMessage,
} from "./promotions.repository";
import { findCustomerById, updateCustomerAfterOrder } from "./customers.repository";

export async function findProductsForCartCancellation(productIds: string[]) {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map(() => "?").join(", ");
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, name FROM products WHERE id IN (${placeholders})`,
    productIds
  );
  return rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}

type ProductRow = RowDataPacket & {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  status: "active" | "paused";
  is_available: number;
  product_type: "single" | "combo";
};
type VariantRow = RowDataPacket & {
  id: string;
  product_id: string;
  name: string;
  sale_price: string;
  is_active: number;
  is_default: number;
};
type ComboComponentRow = {
  product: Pick<ProductRow, "id" | "category_id" | "category_name" | "name" | "status" | "is_available" | "product_type">;
  variant: Pick<VariantRow, "id" | "product_id" | "name" | "sale_price" | "is_active" | "is_default">;
  quantity: number;
};
type ModifierRow = RowDataPacket & {
  id: string;
  name: string;
  price_delta: string;
  is_active: number;
};
type RecipeRow = RowDataPacket & {
  raw_material_id: string;
  raw_material_name: string;
  unit: string;
  quantity: string;
};
type MaterialRow = RowDataPacket & {
  id: string;
  name: string;
  unit: string;
  stock_quantity: string;
  min_stock: string;
  is_active: number;
};
type OpenShiftRow = RowDataPacket & { id: string; status: string; user_id: string };

type PreparedLine = {
  input: NormalizedPosOrderItem;
  product: ProductRow;
  variant: VariantRow;
  modifiers: ModifierRow[];
  recipe: Array<RecipeRow & { factor: number }>;
  comboComponents: ComboComponentRow[];
};

type CreatePosOrderTransactionData = {
  customerId: string | null;
  createdBy: string;
  paymentMethod: PosPaymentMethod;
  note: string | null;
  items: NormalizedPosOrderItem[];
  promotionCode?: string | null;
  changeAmount?: number;
  discountAmount?: number;
  shiftId: string | null;
};

async function loadProduct(connection: PoolConnection, productId: string) {
  const [rows] = await connection.execute<ProductRow[]>(
    `SELECT p.id, p.category_id, c.name AS category_name, p.name,
            p.status, p.is_available, p.product_type
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? LIMIT 1`,
    [productId]
  );
  return rows[0] ?? null;
}

async function loadVariant(
  connection: PoolConnection,
  productId: string,
  variantId: string | null
) {
  const params = variantId ? [productId, variantId] : [productId];
  const [rows] = await connection.execute<VariantRow[]>(
    variantId
      ? `SELECT id, product_id, name, sale_price, is_active, is_default
         FROM product_variants WHERE product_id = ? AND id = ? LIMIT 1`
      : `SELECT id, product_id, name, sale_price, is_active, is_default
         FROM product_variants
         WHERE product_id = ? AND is_default = 1 LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

async function loadComboComponents(connection: PoolConnection, comboProductId: string) {
  const [rows] = await connection.execute<
    (RowDataPacket & ProductRow & { variant_id: string; variant_name: string; variant_sale_price: string; variant_is_active: number; variant_is_default: number; quantity: number })[]
  >(
    `SELECT p.id, p.category_id, c.name AS category_name, p.name, p.status,
            p.is_available, p.product_type,
            pv.id AS variant_id, pv.name AS variant_name, pv.sale_price AS variant_sale_price,
            pv.is_active AS variant_is_active, pv.is_default AS variant_is_default,
            ci.quantity
     FROM combo_items ci
     JOIN products p ON p.id = ci.component_product_id
     JOIN categories c ON c.id = p.category_id
     JOIN product_variants pv ON pv.id = ci.component_variant_id AND pv.product_id = p.id
     WHERE ci.combo_product_id = ?
     ORDER BY ci.id`,
    [comboProductId]
  );
  return rows.map<ComboComponentRow>((row) => ({
    product: {
      id: row.id, category_id: row.category_id, category_name: row.category_name,
      name: row.name, status: row.status, is_available: row.is_available,
      product_type: row.product_type,
    },
    variant: {
      id: row.variant_id, product_id: row.id, name: row.variant_name,
      sale_price: row.variant_sale_price, is_active: row.variant_is_active,
      is_default: row.variant_is_default,
    },
    quantity: Number(row.quantity),
  }));
}

async function loadVariantRecipe(connection: PoolConnection, variantId: string) {
  const [rows] = await connection.execute<RecipeRow[]>(
    `SELECT vri.raw_material_id, rm.name AS raw_material_name, rm.unit, vri.quantity
     FROM variant_recipe_items vri
     JOIN raw_materials rm ON rm.id = vri.raw_material_id
     WHERE vri.variant_id = ?`,
    [variantId]
  );
  return rows;
}

async function loadModifiers(
  connection: PoolConnection,
  productId: string,
  ids: string[]
) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await connection.execute<ModifierRow[]>(
    `SELECT mo.id, mo.name, mo.price_delta, mo.is_active
     FROM product_modifier_options pmo
     JOIN modifier_options mo ON mo.id = pmo.modifier_option_id
     WHERE pmo.product_id = ? AND mo.id IN (${placeholders})`,
    [productId, ...ids]
  );
  if (rows.length !== ids.length) {
    throw new ApiError(400, "Có topping không được phép áp dụng cho món đã chọn.");
  }
  if (rows.some((row) => !row.is_active)) {
    throw new ApiError(409, "Có topping đã ngừng phục vụ.");
  }
  return rows;
}

async function loadModifierRecipe(connection: PoolConnection, modifierId: string) {
  const [rows] = await connection.execute<RecipeRow[]>(
    `SELECT mri.raw_material_id, rm.name AS raw_material_name, rm.unit, mri.quantity
     FROM modifier_recipe_items mri
     JOIN raw_materials rm ON rm.id = mri.raw_material_id
     WHERE mri.modifier_option_id = ?`,
    [modifierId]
  );
  return rows;
}

async function prepareLine(
  connection: PoolConnection,
  input: NormalizedPosOrderItem
): Promise<PreparedLine> {
  const product = await loadProduct(connection, input.productId);
  if (!product) throw new ApiError(404, "Không tìm thấy sản phẩm.");
  const variant = await loadVariant(connection, product.id, input.variantId);
  if (!variant || !variant.is_active) {
    throw new ApiError(409, `Biến thể của "${product.name}" không còn khả dụng.`);
  }
  const modifiers = await loadModifiers(
    connection,
    product.id,
    input.modifierOptionIds
  );
  const recipe: Array<RecipeRow & { factor: number }> = [];
  let comboComponents: ComboComponentRow[] = [];
  if (product.product_type === "combo") {
    if (!variant.is_default) {
      throw new ApiError(400, "Combo phải sử dụng biến thể mặc định đã cấu hình.");
    }
    if (input.modifierOptionIds.length > 0) {
      throw new ApiError(400, "Combo cố định không hỗ trợ topping.");
    }
    comboComponents = await loadComboComponents(connection, product.id);
    if (!comboComponents.length) {
      throw new ApiError(409, `Combo "${product.name}" chưa có món thành phần.`);
    }
    for (const component of comboComponents) {
      if (!component.product.is_available || component.product.status !== "active" || !component.variant.is_active) {
        throw new ApiError(409, `Món thành phần của combo "${product.name}" hiện không bán.`);
      }
      const componentRecipe = await loadVariantRecipe(connection, component.variant.id);
      recipe.push(...componentRecipe.map((item) => ({
        ...item,
        factor: input.quantity * component.quantity,
      })));
    }
  } else {
    const variantRecipe = await loadVariantRecipe(connection, variant.id);
    recipe.push(...variantRecipe.map((item) => ({ ...item, factor: input.quantity })));
  }

  for (const modifier of modifiers) {
    const modifierRecipe = await loadModifierRecipe(connection, modifier.id);
    recipe.push(...modifierRecipe.map((item) => ({ ...item, factor: input.quantity })));
  }
  return { input, product, variant, modifiers, recipe, comboComponents };
}

async function lockOpenShift(
  connection: PoolConnection,
  shiftId: string,
  employeeId: string
) {
  const [rows] = await connection.execute<OpenShiftRow[]>(
    "SELECT id, status, user_id FROM shifts WHERE id = ? LIMIT 1 FOR UPDATE",
    [shiftId]
  );
  const shift = rows[0];
  if (!shift || shift.status !== "OPEN") {
    throw new ApiError(409, "Ca làm đã đóng hoặc không còn khả dụng.");
  }
  if (shift.user_id !== employeeId) {
    throw new ApiError(403, "Ca làm không thuộc nhân viên đang bán hàng.");
  }
}

export async function createPosOrderTransaction(
  data: CreatePosOrderTransactionData
): Promise<PosOrderResult> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (data.shiftId) await lockOpenShift(connection, data.shiftId, data.createdBy);

    const customer = data.customerId
      ? await findCustomerById(connection, data.customerId)
      : null;
    if (data.customerId && !customer) {
      throw new ApiError(404, "Không tìm thấy khách hàng.");
    }

    const prepared = [];
    for (const item of data.items) prepared.push(await prepareLine(connection, item));

    const productIds = Array.from(
      new Set(prepared.flatMap((line) => [
        line.product.id,
        ...line.comboComponents.map((component) => component.product.id),
      ]))
    ).sort();
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      const [lockedProducts] = await connection.execute<ProductRow[]>(
        `SELECT p.id, p.category_id, c.name AS category_name, p.name,
                p.status, p.is_available, p.product_type
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.id IN (${placeholders}) ORDER BY p.id FOR UPDATE`,
        productIds
      );
      const byId = new Map(lockedProducts.map((item) => [item.id, item]));
      for (const line of prepared) {
        for (const product of [line.product, ...line.comboComponents.map((component) => component.product)]) {
          const live = byId.get(product.id);
        if (!live?.is_available || live.status !== "active") {
          throw new ApiError(409, `Sản phẩm "${line.product.name}" hiện không bán.`);
        }
        }
      }
    }

    const variantIds = Array.from(
      new Set(prepared.flatMap((line) => [
        line.variant.id,
        ...line.comboComponents.map((component) => component.variant.id),
      ]))
    ).sort();
    if (variantIds.length) {
      const placeholders = variantIds.map(() => "?").join(",");
      await connection.execute(
        `SELECT id FROM product_variants
         WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
        variantIds
      );
    }

    const modifierIds = Array.from(
      new Set(prepared.flatMap((line) => line.modifiers.map((item) => item.id)))
    ).sort();
    if (modifierIds.length) {
      const placeholders = modifierIds.map(() => "?").join(",");
      await connection.execute(
        `SELECT id FROM modifier_options
         WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
        modifierIds
      );
    }

    const materialNeeds = new Map<
      string,
      { name: string; unit: string; quantity: number }
    >();
    for (const line of prepared) {
      for (const item of line.recipe) {
        const quantity = Number(item.quantity) * item.factor;
        const current = materialNeeds.get(item.raw_material_id);
        materialNeeds.set(item.raw_material_id, {
          name: item.raw_material_name,
          unit: item.unit,
          quantity: (current?.quantity ?? 0) + quantity,
        });
      }
    }
    const materialIds = [...materialNeeds.keys()].sort();
    const materialBalances = new Map<string, MaterialRow>();
    if (materialIds.length) {
      const placeholders = materialIds.map(() => "?").join(",");
      const [materials] = await connection.execute<MaterialRow[]>(
        `SELECT id, name, unit, stock_quantity, min_stock, is_active
         FROM raw_materials
         WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
        materialIds
      );
      for (const material of materials) materialBalances.set(material.id, material);
      for (const [id, need] of materialNeeds) {
        const material = materialBalances.get(id);
        if (
          !material ||
          !material.is_active ||
          Number(material.stock_quantity) < need.quantity
        ) {
          throw new ApiError(
            409,
            `Thiếu nguyên liệu "${need.name}": cần ${need.quantity} ${need.unit}, còn ${Number(material?.stock_quantity ?? 0)} ${need.unit}.`
          );
        }
      }
    }

    const orderId = randomUUID();
    const details: PosOrderDetail[] = prepared.map((line) => {
      const unitPrice =
        Number(line.variant.sale_price) +
        line.modifiers.reduce((sum, item) => sum + Number(item.price_delta), 0);
      const snapshot = {
        variant: {
          id: line.variant.id,
          name: line.variant.name,
          salePrice: Number(line.variant.sale_price),
        },
        modifiers: line.modifiers.map((item) => ({
          id: item.id,
          name: item.name,
          priceDelta: Number(item.price_delta),
        })),
        note: line.input.note,
        comboComponents: line.comboComponents.map((component) => ({
          productId: component.product.id,
          productName: component.product.name,
          variantId: component.variant.id,
          variantName: component.variant.name,
          quantity: component.quantity,
        })),
      };
      return {
        id: randomUUID(),
        productId: line.product.id,
        productName: line.product.name,
        categoryId: line.product.category_id,
        categoryName: line.product.category_name,
        variantId: line.variant.id,
        variantName: line.variant.name,
        modifierOptions: snapshot.modifiers,
        itemNote: line.input.note,
        configurationSnapshot: snapshot,
        quantity: line.input.quantity,
        unitPrice,
        lineTotal: unitPrice * line.input.quantity,
      };
    });
    const totalAmount = details.reduce((sum, item) => sum + item.lineTotal, 0);
    const appliedPromotion = await calculateBestPosPromotion(
      connection,
      details,
      totalAmount,
      data.promotionCode
    );
    if (data.promotionCode && !appliedPromotion) {
      throw new ApiError(
        400,
        (await getPromotionCodeFailureMessage(
          connection,
          details,
          data.promotionCode
        )) ?? "Mã khuyến mãi không hợp lệ."
      );
    }
    const discountAmount = Math.min(
      appliedPromotion?.discountAmount ?? 0,
      totalAmount
    );
    const finalAmount = totalAmount - discountAmount;
    const promotionId =
      appliedPromotion?.ruleType === "product_code" ? appliedPromotion.id : null;

    await connection.execute(
      `INSERT INTO orders
        (id, customer_id, shift_id, created_by, promotion_id, status,
         total_amount, discount_amount, final_amount, note)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
      [
        orderId,
        data.customerId,
        data.shiftId,
        data.createdBy,
        promotionId,
        totalAmount,
        discountAmount,
        finalAmount,
        data.note,
      ]
    );

    for (let index = 0; index < details.length; index += 1) {
      const detail = details[index];
      const line = prepared[index];
      await connection.execute(
        `INSERT INTO order_details
          (id, order_id, product_id, variant_id, quantity, unit_price,
           line_total, item_note, configuration_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          detail.id,
          orderId,
          detail.productId,
          detail.variantId ?? null,
          detail.quantity,
          detail.unitPrice,
          detail.lineTotal,
          detail.itemNote ?? null,
          JSON.stringify(detail.configurationSnapshot ?? {}),
        ]
      );
      for (const recipe of line.recipe) {
        const consumed = Number(recipe.quantity) * recipe.factor;
        const material = materialBalances.get(recipe.raw_material_id)!;
        const before = Number(material.stock_quantity);
        const after = before - consumed;
        material.stock_quantity = String(after);
        await connection.execute(
          `INSERT INTO raw_material_transactions
            (id, raw_material_id, order_detail_id, created_by, transaction_type,
             quantity, stock_delta, stock_before, stock_after, note)
           VALUES (?, ?, ?, ?, 'sale_consumption', ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            recipe.raw_material_id,
            detail.id,
            data.createdBy,
            consumed,
            -consumed,
            before,
            after,
            `Tiêu hao theo công thức - đơn ${orderId}`,
          ]
        );
      }
    }

    for (const [id, material] of materialBalances) {
      await connection.execute(
        "UPDATE raw_materials SET stock_quantity = ? WHERE id = ?",
        [Number(material.stock_quantity), id]
      );
    }

    if (customer) {
      await updateCustomerAfterOrder(connection, data.customerId!, finalAmount);
    }
    const paymentId = randomUUID();
    await connection.execute(
      `INSERT INTO payments
        (id, order_id, payment_method, amount, payment_status, paid_at)
       VALUES (?, ?, ?, ?, 'paid', NOW())`,
      [paymentId, orderId, data.paymentMethod, finalAmount]
    );
    await connection.execute(
      `INSERT INTO audit_logs
        (id, user_id, action_type, target_object, description)
       VALUES (?, ?, 'BAN_HANG', ?, ?)`,
      [
        randomUUID(),
        data.createdBy,
        `Đơn #${orderId}`,
        `Thanh toán đơn hàng ${finalAmount.toLocaleString("vi-VN")}đ.`,
      ]
    );
    await connection.commit();

    const alerts = [...materialBalances.values()]
      .filter((item) => Number(item.stock_quantity) <= Number(item.min_stock))
      .map((item) => ({
        name: item.name,
        stockQuantity: Number(item.stock_quantity),
        minStock: Number(item.min_stock),
      }));
    return {
      id: orderId,
      customerId: data.customerId,
      createdBy: data.createdBy,
      status: "completed",
      totalAmount,
      discountAmount,
      finalAmount,
      changeAmount: data.changeAmount ?? 0,
      note: data.note,
      appliedPromotion: appliedPromotion
        ? {
            id: appliedPromotion.id,
            code: appliedPromotion.code,
            name: appliedPromotion.name,
            ruleType: appliedPromotion.ruleType,
            discountAmount,
          }
        : null,
      details,
      payment: {
        id: paymentId,
        paymentMethod: data.paymentMethod,
        amount: finalAmount,
        paymentStatus: "paid",
      },
      alerts,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
