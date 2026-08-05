import { useCallback, useEffect, useState } from "react";
import { fetchMaterials, type Material } from "../../api/inventory.api";
import {
  getProductConfiguration,
  saveProductConfiguration,
  updateProduct,
  createProduct,
  uploadProductImage,
  type ModifierOption,
  type ComboItem,
  type Product,
  type ProductConfiguration,
  type ProductVariant,
  type RecipeItem,
} from "../../api/product.api";
import type { Category } from "../../api/category.api";
import { Icon } from "../../layouts/AdminLayout";

type Props = {
  product: Product | null;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
};

const newId = () => crypto.randomUUID();
const emptyRecipe = (): RecipeItem => ({
  rawMaterialId: "",
  quantity: 1,
});

export default function ProductConfigurationModal({
  product,
  products,
  categories,
  onClose,
  onSaved,
}: Props) {
  const [configuration, setConfiguration] = useState<ProductConfiguration | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [generalProduct, setGeneralProduct] = useState<Partial<Product>>(
    product || {
      name: "",
      sku: "",
      categoryId: categories[0]?.id || "",
      importPrice: 0,
      salePrice: 0,
      isAvailable: true,
      description: "",
      imageUrl: "",
      status: "active",
    }
  );
  const [imageSource, setImageSource] = useState<"file" | "url">(
    product?.imageUrl && !product.imageUrl.includes("/uploads/") ? "url" : "file"
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [tab, setTab] = useState<"general" | "variants" | "modifiers" | "combo">("general");
  const [componentVariants, setComponentVariants] = useState<Record<string, ProductVariant[]>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchMaterialsTask = fetchMaterials().then((res) =>
      setMaterials(res.data.filter((item) => item.isActive))
    );

    if (product) {
      void Promise.all([getProductConfiguration(product.id), fetchMaterialsTask])
        .then(([config]) => {
          setConfiguration(config.data);
        })
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : "Không tải được cấu hình.")
        );
    } else {
      void fetchMaterialsTask.then(() => {
        setConfiguration({
          productId: "",
          productType: "single",
          variants: [
            {
              id: newId(),
              productId: "",
              name: "Size M",
              salePrice: 0,
              isDefault: true,
              isActive: true,
              recipeItems: [],
            },
          ],
          modifierOptions: [],
          comboItems: [],
        });
      });
    }
  }, [product, categories]);

  const loadComponentVariants = useCallback(async (productId: string) => {
    if (!productId || componentVariants[productId]) return;
    const response = await getProductConfiguration(productId);
    setComponentVariants((current) => ({
      ...current,
      [productId]: response.data.variants.filter((item) => item.isActive !== false),
    }));
  }, [componentVariants]);

  useEffect(() => {
    if (!configuration?.comboItems.length) return;
    void Promise.all(
      Array.from(new Set(configuration.comboItems.map((item) => item.componentProductId)))
        .map((id) => loadComponentVariants(id))
    ).catch((reason) =>
      setError(reason instanceof Error ? reason.message : "Không tải được biến thể món trong combo.")
    );
  }, [configuration?.comboItems, loadComponentVariants]);

  const updateRecipe = (
    owner: "variant" | "modifier",
    ownerId: string,
    recipeItems: RecipeItem[]
  ) => {
    if (!configuration) return;
    if (owner === "variant") {
      setConfiguration({
        ...configuration,
        variants: configuration.variants.map((item) =>
          item.id === ownerId ? { ...item, recipeItems } : item
        ),
      });
    } else {
      setConfiguration({
        ...configuration,
        modifierOptions: configuration.modifierOptions.map((item) =>
          item.id === ownerId ? { ...item, recipeItems } : item
        ),
      });
    }
  };

  const RecipeEditor = ({
    owner,
    ownerId,
    items,
  }: {
    owner: "variant" | "modifier";
    ownerId: string;
    items: RecipeItem[];
  }) => (
    <div className="space-y-2">
      {items.map((recipe, index) => {
        const material = materials.find(
          (item) => item.id === recipe.rawMaterialId
        );
        return (
          <div key={`${ownerId}-${index}`} className="grid grid-cols-[1fr_110px_36px] gap-2">
            <select
              value={recipe.rawMaterialId}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...recipe, rawMaterialId: event.target.value };
                updateRecipe(owner, ownerId, next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Chọn nguyên liệu</option>
              {materials.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={recipe.quantity}
                onChange={(event) => {
                  const next = [...items];
                  next[index] = { ...recipe, quantity: Number(event.target.value) };
                  updateRecipe(owner, ownerId, next);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-9 text-sm"
              />
              <span className="absolute right-2 top-2.5 text-xs text-slate-400">
                {material?.unit}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                updateRecipe(
                  owner,
                  ownerId,
                  items.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              className="rounded-lg text-rose-500 hover:bg-rose-50"
            >
              <Icon name="delete" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => updateRecipe(owner, ownerId, [...items, emptyRecipe()])}
        className="text-sm font-bold text-[#f97316]"
      >
        + Thêm nguyên liệu
      </button>
    </div>
  );

  async function handleImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      const response = await uploadProductImage(file);
      setGeneralProduct((current) => ({
        ...current,
        imageUrl: response.data.imageUrl,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh sản phẩm.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  const save = async () => {
    if (!configuration) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        categoryId: generalProduct.categoryId || categories[0]?.id || "",
        sku: generalProduct.sku || "",
        name: generalProduct.name || "",
        importPrice: generalProduct.importPrice || 0,
        salePrice: generalProduct.salePrice || 0,
        status: generalProduct.status || "active",
        description: generalProduct.description || null,
        imageUrl: generalProduct.imageUrl || null,
        isAvailable: generalProduct.isAvailable,
      };

      let savedProductId = product?.id;

      if (savedProductId) {
        await updateProduct(savedProductId, payload);
      } else {
        const response = await createProduct(payload);
        savedProductId = response.data.id;
      }

      await saveProductConfiguration(savedProductId, {
        productType: configuration.productType,
        variants: configuration.variants,
        modifierOptions: configuration.productType === "combo" ? [] : configuration.modifierOptions,
        comboItems: configuration.comboItems.map((item) => ({
          id: item.id,
          componentProductId: item.componentProductId,
          componentVariantId: item.componentVariantId,
          quantity: item.quantity,
        })),
      });
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  if (!configuration) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50">
        <div className="rounded-2xl bg-white p-8 font-bold">
          {error || "Đang tải cấu hình món..."}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <p className="text-xs font-black uppercase text-[#f97316]">
              {product ? "Cập nhật công thức & Món" : "Sản phẩm mới"}
            </p>
            <h3 className="text-xl font-black text-[#0b1c30]">
              {generalProduct.name || "Tạo món và thiết lập công thức "}
            </h3>
          </div>
          <button type="button" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="flex gap-2 border-b px-5 pt-3">
          {[
            ["general", "Thông tin chung"],
            ["variants", "Biến thể và công thức"],
            ...(configuration.productType === "combo" ? [] : [["modifiers", "Topping"]]),
            ["combo", "Combo cố định"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as typeof tab)}
              className={`border-b-2 px-4 py-3 text-sm font-bold ${
                tab === value
                  ? "border-[#f97316] text-[#f97316]"
                  : "border-transparent text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "general" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Tên sản phẩm</span>
                <input
                  value={generalProduct.name}
                  onChange={(event) =>
                    setGeneralProduct({
                      ...generalProduct,
                      name: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>SKU</span>
                <input
                  value={generalProduct.sku}
                  onChange={(event) =>
                    setGeneralProduct({
                      ...generalProduct,
                      sku: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Danh mục</span>
                <select
                  value={generalProduct.categoryId}
                  onChange={(event) =>
                    setGeneralProduct({
                      ...generalProduct,
                      categoryId: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Giá nhập</span>
                <input
                  type="number"
                  min="0"
                  value={generalProduct.importPrice}
                  onChange={(event) =>
                    setGeneralProduct({
                      ...generalProduct,
                      importPrice: Number(event.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Giá bán mặc định</span>
                <input
                  type="number"
                  min="0"
                  value={generalProduct.salePrice}
                  onChange={(event) => {
                    const salePrice = Number(event.target.value);
                    setGeneralProduct({ ...generalProduct, salePrice });
                    setConfiguration({
                      ...configuration,
                      variants: configuration.variants.map((item) =>
                        item.isDefault ? { ...item, salePrice } : item
                      ),
                    });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700 md:col-span-2">
                <span>Mô tả</span>
                <textarea
                  rows={3}
                  value={generalProduct.description || ""}
                  onChange={(event) =>
                    setGeneralProduct({
                      ...generalProduct,
                      description: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <div className="space-y-3 md:col-span-2">
                <label className="block space-y-1">
                  <span className="text-sm font-bold text-slate-700">Nguồn ảnh sản phẩm</span>
                  <select
                    value={imageSource}
                    onChange={(event) => setImageSource(event.target.value as "file" | "url")}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="file">Tải ảnh từ máy</option>
                    <option value="url">Nhập link ảnh</option>
                  </select>
                </label>

                {imageSource === "file" ? (
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => {
                      void handleImageFileChange(event);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-xs file:font-black file:text-[#f97316]"
                  />
                ) : (
                  <input
                    type="url"
                    value={generalProduct.imageUrl || ""}
                    onChange={(event) =>
                      setGeneralProduct((current) => ({
                        ...current,
                        imageUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                )}
                {isUploadingImage ? (
                  <p className="text-xs font-bold text-slate-400">Đang tải ảnh...</p>
                ) : null}
              </div>

              {generalProduct.imageUrl ? (
                <div className="relative border border-slate-200 md:col-span-2">
                  <img
                    src={generalProduct.imageUrl}
                    alt="Ảnh xem trước"
                    className="h-44 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setGeneralProduct((current) => ({ ...current, imageUrl: "" }))}
                    className="absolute right-3 top-3 bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700"
                  >
                    Xóa ảnh
                  </button>
                </div>
              ) : null}

              <label className="flex items-center gap-3 md:col-span-2 py-2">
                <input
                  type="checkbox"
                  checked={generalProduct.isAvailable}
                  onChange={(event) =>
                    setGeneralProduct((current) => ({
                      ...current,
                      isAvailable: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-[#f97316]"
                />
                <span className="text-sm font-bold text-[#0b1c30]">
                  Cho phép bán tại POS
                </span>
              </label>
            </div>
          ) : null}
          {tab === "variants" ? (
            <div className="space-y-4">
              {configuration.variants.map((variant) => (
                <div key={variant.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-4 grid grid-cols-[1fr_180px_auto_40px] gap-3">
                    <input
                      value={variant.name}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          variants: configuration.variants.map((item) =>
                            item.id === variant.id
                              ? { ...item, name: event.target.value }
                              : item
                          ),
                        })
                      }
                      placeholder="Tên size/biến thể"
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    />
                    <input
                      type="number"
                      min="0"
                      value={variant.salePrice}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          variants: configuration.variants.map((item) =>
                            item.id === variant.id
                              ? { ...item, salePrice: Number(event.target.value) }
                              : item
                          ),
                        })
                      }
                      placeholder="Giá bán"
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    />
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        type="radio"
                        checked={Boolean(variant.isDefault)}
                        onChange={() =>
                          setConfiguration({
                            ...configuration,
                            variants: configuration.variants.map((item) => ({
                              ...item,
                              isDefault: item.id === variant.id,
                            })),
                          })
                        }
                      />
                      Mặc định
                    </label>
                    <button
                      type="button"
                      disabled={configuration.variants.length === 1}
                      onClick={() => {
                        const remaining = configuration.variants.filter(
                          (item) => item.id !== variant.id
                        );
                        if (
                          variant.isDefault &&
                          remaining.length > 0 &&
                          !remaining.some((item) => item.isDefault)
                        ) {
                          remaining[0] = { ...remaining[0], isDefault: true };
                        }
                        setConfiguration({
                          ...configuration,
                          variants: remaining,
                        });
                      }}
                      className="rounded-lg text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Xóa biến thể"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                  {configuration.productType === "combo" ? (
                    <p className="text-sm text-slate-500">
                      Định mức combo được tính từ các món thành phần cố định.
                    </p>
                  ) : (
                    <RecipeEditor owner="variant" ownerId={variant.id} items={variant.recipeItems} />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setConfiguration({
                    ...configuration,
                    variants: [
                      ...configuration.variants,
                      {
                        id: newId(),
                        productId: product?.id || "",
                        name: `Size ${configuration.variants.length + 1}`,
                        salePrice: product?.salePrice || 0,
                        isDefault: configuration.variants.length === 0,
                        isActive: true,
                        recipeItems: [],
                      } as ProductVariant,
                    ],
                  })
                }
                className="rounded-lg border border-[#f97316] px-4 py-2 font-bold text-[#f97316]"
              >
                + Thêm biến thể
              </button>
            </div>
          ) : null}

          {tab === "modifiers" ? (
            <div className="space-y-4">
              {configuration.modifierOptions.map((modifier) => (
                <div key={modifier.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-4 grid grid-cols-[1fr_180px_40px] gap-3">
                    <input
                      value={modifier.name}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          modifierOptions: configuration.modifierOptions.map((item) =>
                            item.id === modifier.id
                              ? { ...item, name: event.target.value }
                              : item
                          ),
                        })
                      }
                      placeholder="Tên topping"
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    />
                    <input
                      type="number"
                      min="0"
                      value={modifier.priceDelta}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          modifierOptions: configuration.modifierOptions.map((item) =>
                            item.id === modifier.id
                              ? { ...item, priceDelta: Number(event.target.value) }
                              : item
                          ),
                        })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConfiguration({
                          ...configuration,
                          modifierOptions: configuration.modifierOptions.filter(
                            (item) => item.id !== modifier.id
                          ),
                        })
                      }
                      className="text-rose-500"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                  <RecipeEditor
                    owner="modifier"
                    ownerId={modifier.id}
                    items={modifier.recipeItems}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setConfiguration({
                    ...configuration,
                    modifierOptions: [
                      ...configuration.modifierOptions,
                      {
                        id: newId(),
                        name: "Topping mới",
                        priceDelta: 0,
                        isActive: true,
                        recipeItems: [],
                      } as ModifierOption,
                    ],
                  })
                }
                className="rounded-lg border border-[#f97316] px-4 py-2 font-bold text-[#f97316]"
              >
                + Thêm topping
              </button>
            </div>
          ) : null}

          {tab === "combo" ? (
            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={configuration.productType === "combo"}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      productType: event.target.checked ? "combo" : "single",
                      comboItems: event.target.checked ? configuration.comboItems : [],
                    })
                  }
                />
                Đây là sản phẩm combo cố định
              </label>
              {configuration.productType === "combo" ? (
                <>
                  <p className="text-sm text-slate-500">
                    Khách không đổi món hoặc size trong combo. Giá bán lấy từ biến thể mặc định của combo.
                  </p>
                  {configuration.comboItems.map((item, index) => {
                    const variants = componentVariants[item.componentProductId] || [];
                    return (
                      <div key={item.id || index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_36px] gap-3 rounded-xl border border-slate-200 p-3">
                        <select
                          value={item.componentProductId}
                          onChange={(event) => {
                            const componentProductId = event.target.value;
                            const next = [...configuration.comboItems];
                            next[index] = { ...item, componentProductId, componentVariantId: "" };
                            setConfiguration({ ...configuration, comboItems: next });
                            void loadComponentVariants(componentProductId).catch((reason) =>
                              setError(reason instanceof Error ? reason.message : "Không tải được biến thể.")
                            );
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <option value="">Chọn món</option>
                          {products.filter((candidate) => candidate.id !== product?.id && candidate.productType !== "combo").map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                          ))}
                        </select>
                        <select
                          value={item.componentVariantId}
                          disabled={!item.componentProductId}
                          onChange={(event) => {
                            const next = [...configuration.comboItems];
                            next[index] = { ...item, componentVariantId: event.target.value };
                            setConfiguration({ ...configuration, comboItems: next });
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                        >
                          <option value="">Chọn size/biến thể</option>
                          {variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>{variant.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => {
                            const next = [...configuration.comboItems];
                            next[index] = { ...item, quantity: Number(event.target.value) };
                            setConfiguration({ ...configuration, comboItems: next });
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-2"
                        />
                        <button
                          type="button"
                          onClick={() => setConfiguration({
                            ...configuration,
                            comboItems: configuration.comboItems.filter((_, itemIndex) => itemIndex !== index),
                          })}
                          className="text-rose-500"
                          title="Xóa món khỏi combo"
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setConfiguration({
                      ...configuration,
                      comboItems: [...configuration.comboItems, {
                        id: newId(), componentProductId: "", componentProductName: "",
                        componentVariantId: "", componentVariantName: "", quantity: 1,
                      } as ComboItem],
                    })}
                    className="rounded-lg border border-[#f97316] px-4 py-2 font-bold text-[#f97316]"
                  >
                    + Thêm món vào combo
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">Bật lựa chọn này khi món được bán với các thành phần cố định.</p>
              )}
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm font-bold text-rose-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-3 border-t p-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-5 py-2">
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-[#f97316] px-5 py-2 font-bold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : product ? "Lưu sản phẩm" : "Tạo sản phẩm"}
          </button>
        </div>
      </div>
    </div>
  );
}
