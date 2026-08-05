export type RecipeItemInput = {
  rawMaterialId: string;
  quantity: number;
};

export type RecipeItem = RecipeItemInput & {
  rawMaterialName: string;
  unit: string;
};

export type ProductVariantInput = {
  id?: string;
  name: string;
  sku?: string | null;
  salePrice: number;
  isDefault?: boolean;
  isActive?: boolean;
  recipeItems?: RecipeItemInput[];
};

export type ProductVariant = Omit<ProductVariantInput, "id" | "recipeItems"> & {
  id: string;
  productId: string;
  recipeItems: RecipeItem[];
};

export type ModifierOptionInput = {
  id?: string;
  name: string;
  priceDelta: number;
  isActive?: boolean;
  recipeItems?: RecipeItemInput[];
};

export type ModifierOption = Omit<ModifierOptionInput, "id" | "recipeItems"> & {
  id: string;
  recipeItems: RecipeItem[];
};

export type ProductType = "single" | "combo";

export type ComboItemInput = {
  id?: string;
  componentProductId: string;
  componentVariantId: string;
  quantity: number;
};

export type ComboItem = ComboItemInput & {
  id: string;
  componentProductName: string;
  componentVariantName: string;
};

export type ProductConfiguration = {
  productId: string;
  productType: ProductType;
  variants: ProductVariant[];
  modifierOptions: ModifierOption[];
  comboItems: ComboItem[];
};

export type SaveProductConfigurationBody = {
  productType?: ProductType;
  variants: ProductVariantInput[];
  modifierOptions?: ModifierOptionInput[];
  comboItems?: ComboItemInput[];
};
