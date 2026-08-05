import { createAuditLog } from "../repositories/audit-log.repository";
import {
  findProductConfiguration,
  saveProductConfiguration,
} from "../repositories/product-configuration.repository";
import { findProductById } from "../repositories/product.repository";
import type {
  RecipeItemInput,
  SaveProductConfigurationBody,
} from "../types/product-configuration.types";
import { ApiError } from "../utils/apiError";

function validateRecipes(items: RecipeItemInput[] | undefined) {
  const materialIds = new Set<string>();
  for (const item of items || []) {
    if (!item.rawMaterialId?.trim()) {
      throw new ApiError(400, "Nguyên liệu trong công thức không hợp lệ.");
    }
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
      throw new ApiError(400, "Định mức nguyên liệu phải lớn hơn 0.");
    }
    if (materialIds.has(item.rawMaterialId)) {
      throw new ApiError(400, "Một nguyên liệu không được lặp trong cùng công thức.");
    }
    materialIds.add(item.rawMaterialId);
  }
}

export async function getProductConfigurationService(productId: string) {
  const configuration = await findProductConfiguration(productId);
  if (!configuration) throw new ApiError(404, "Không tìm thấy sản phẩm.");
  return configuration;
}

export async function saveProductConfigurationService(
  productId: string,
  body: SaveProductConfigurationBody,
  userId?: string
) {
  const product = await findProductById(productId);
  if (!product) throw new ApiError(404, "Không tìm thấy sản phẩm.");
  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    throw new ApiError(400, "Sản phẩm phải có ít nhất một biến thể.");
  }
  if (body.variants.filter((item) => item.isDefault).length !== 1) {
    throw new ApiError(400, "Sản phẩm phải có đúng một biến thể mặc định.");
  }
  if (body.variants.some((item) => item.isDefault && item.isActive === false)) {
    throw new ApiError(400, "Biến thể mặc định phải ở trạng thái hoạt động.");
  }

  const productType = body.productType === "combo" ? "combo" : "single";
  const comboItems = body.comboItems || [];
  if (productType === "combo" && comboItems.length === 0) {
    throw new ApiError(400, "Combo cố định phải có ít nhất một món thành phần.");
  }
  const comboKeys = new Set<string>();
  for (const item of comboItems) {
    const productId = item.componentProductId?.trim();
    const variantId = item.componentVariantId?.trim();
    const quantity = Number(item.quantity);
    if (!productId || !variantId || productId === product.id || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, "Món thành phần, biến thể hoặc số lượng combo không hợp lệ.");
    }
    const key = `${productId}:${variantId}`;
    if (comboKeys.has(key)) {
      throw new ApiError(400, "Một món và biến thể chỉ được khai báo một lần trong combo.");
    }
    comboKeys.add(key);
  }

  const names = new Set<string>();
  for (const variant of body.variants) {
    const name = variant.name?.trim().toLocaleLowerCase("vi");
    if (!name || names.has(name)) {
      throw new ApiError(400, "Tên biến thể không được để trống hoặc trùng nhau.");
    }
    names.add(name);
    if (!Number.isFinite(Number(variant.salePrice)) || Number(variant.salePrice) < 0) {
      throw new ApiError(400, "Giá biến thể không hợp lệ.");
    }
    validateRecipes(variant.recipeItems);
  }

  const modifierNames = new Set<string>();
  for (const modifier of productType === "combo" ? [] : body.modifierOptions || []) {
    const name = modifier.name?.trim().toLocaleLowerCase("vi");
    if (!name || modifierNames.has(name) || !Number.isFinite(Number(modifier.priceDelta)) || Number(modifier.priceDelta) < 0) {
      throw new ApiError(400, "Thông tin topping không hợp lệ.");
    }
    modifierNames.add(name);
    validateRecipes(modifier.recipeItems);
  }

  const before = await findProductConfiguration(productId);
  const saved = await saveProductConfiguration(productId, {
    productType,
    variants: body.variants.map((item) => ({
      ...item,
      name: item.name.trim(),
      sku: item.sku?.trim() || null,
      salePrice: Number(item.salePrice),
      recipeItems: (item.recipeItems || []).map((recipe) => ({
        rawMaterialId: recipe.rawMaterialId,
        quantity: Number(recipe.quantity),
      })),
    })),
    modifierOptions: (body.modifierOptions || []).map((item) => ({
      ...item,
      name: item.name.trim(),
      priceDelta: Number(item.priceDelta),
      recipeItems: (item.recipeItems || []).map((recipe) => ({
        rawMaterialId: recipe.rawMaterialId,
        quantity: Number(recipe.quantity),
      })),
    })),
    comboItems: comboItems.map((item) => ({
      id: item.id,
      componentProductId: item.componentProductId.trim(),
      componentVariantId: item.componentVariantId.trim(),
      quantity: Number(item.quantity),
    })),
  });
  if (userId) {
    void createAuditLog(
      userId,
      "SUA_SAN_PHAM",
      `Công thức: ${product.name}`,
      `Cập nhật biến thể, công thức và topping của ${product.name}.`,
      before,
      saved
    );
  }
  return saved;
}
