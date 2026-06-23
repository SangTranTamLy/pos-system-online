import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { getCategories, type Category } from "../../api/category.api";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  uploadProductImage,
  type Product,
} from "../../api/product.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type ProductFormState = {
  categoryId: string;
  sku: string;
  name: string;
  importPrice: string;
  salePrice: string;
  stockQuantity: string;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
};

type NoticeState = {
  type: "success" | "error";
  message: string;
};

const defaultFormState: ProductFormState = {
  categoryId: "",
  sku: "",
  name: "",
  importPrice: "0",
  salePrice: "",
  stockQuantity: "0",
  description: "",
  imageUrl: "",
  isAvailable: true,
};

const pageSize = 8;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().normalize("NFC");
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string, delimiter = ",") {
  const values: string[] = [];
  let currentValue = "";
  let isInsideQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && isInsideQuote && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isInsideQuote = !isInsideQuote;
      continue;
    }

    if (char === delimiter && !isInsideQuote) {
      values.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  values.push(currentValue.trim());
  return values;
}

function parseImportedNumber(value: string) {
  const cleanedValue = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsedValue = Number(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getStockState(product: Product) {
  if (!product.isTrackedStock) {
    return {
      label: product.isAvailable ? "Đang bán" : "Ngừng bán",
      className: product.isAvailable
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-slate-50 text-slate-500 border-slate-200",
    };
  }

  const quantity = product.stockQuantity ?? 0;

  if (quantity <= 0) {
    return {
      label: "Hết hàng",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }

  if (quantity <= 10) {
    return {
      label: "Sắp hết",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    label: "Còn hàng",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  tone: "blue" | "green" | "amber" | "rose";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <article className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-[#0b1c30]">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center ${tones[tone]}`}>
          <Icon name={icon} className="text-xl" />
        </div>
      </div>
    </article>
  );
}

function ProductPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryQuery = searchParams.get("category") ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(defaultFormState);
  const [imageSource, setImageSource] = useState<"file" | "url">("file");

  const showNotice = useCallback((message: string, type: NoticeState["type"] = "error") => {
    setNotice({ message, type });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      const loadedCategories = categoriesResponse.data;

      setProducts(productsResponse.data);
      setCategories(loadedCategories);

      if (categoryQuery) {
        const selectedCategory = loadedCategories.find(
          (category) =>
            category.id === categoryQuery ||
            normalizeText(category.name) === normalizeText(categoryQuery)
        );

        if (selectedCategory) {
          setCategoryFilter(selectedCategory.id);
          setPage(1);
        }
      }
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Không tải được dữ liệu sản phẩm. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  }, [categoryQuery, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice || notice.type !== "success") return undefined;

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const stats = useMemo(() => {
    const availableCount = products.filter((product) =>
      product.isTrackedStock
        ? product.stockQuantity !== null && product.stockQuantity > 0
        : product.isAvailable
    ).length;
    const lowStockCount = products.filter(
      (product) =>
        product.isTrackedStock &&
        product.stockQuantity !== null &&
        product.stockQuantity > 0 &&
        product.stockQuantity <= 10
    ).length;
    const outOfStockCount = products.filter((product) =>
      product.isTrackedStock
        ? product.stockQuantity === null || product.stockQuantity <= 0
        : !product.isAvailable
    ).length;
    const inventoryValue = products.reduce((sum, product) => {
      if (!product.isTrackedStock || product.stockQuantity === null) return sum;
      return sum + product.stockQuantity * product.importPrice;
    }, 0);

    return [
      {
        label: "Tổng sản phẩm",
        value: String(products.length),
        icon: "package_2",
        tone: "blue" as const,
      },
      {
        label: "Đang bán",
        value: String(availableCount),
        icon: "check_circle",
        tone: "green" as const,
      },
      {
        label: "Sắp hết hàng",
        value: String(lowStockCount),
        icon: "warning",
        tone: "amber" as const,
      },
      {
        label: "Giá trị tồn kho",
        value: formatCurrency(inventoryValue),
        icon: "warehouse",
        tone: "blue" as const,
      },
      {
        label: "Hết hàng/ngừng bán",
        value: String(outOfStockCount),
        icon: "error",
        tone: "rose" as const,
      },
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(search);

    return products.filter((product) => {
      const stockState = getStockState(product);
      const matchesSearch =
        query.length === 0 ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.sku).includes(query);
      const matchesCategory =
        categoryFilter === "all" || product.categoryId === categoryFilter;
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" &&
          product.isAvailable &&
          stockState.label !== "Hết hàng") ||
        (availabilityFilter === "low" && stockState.label === "Sắp hết") ||
        (availabilityFilter === "unavailable" &&
          (!product.isAvailable || stockState.label === "Hết hàng"));

      return matchesSearch && matchesCategory && matchesAvailability;
    });
  }, [availabilityFilter, categoryFilter, products, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  function openCreateModal() {
    setEditingProduct(null);
    setFormState({
      ...defaultFormState,
      categoryId: categories[0]?.id ?? "",
      isAvailable: true,
    });
    setImageSource("file");
    setIsModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setFormState({
      categoryId: product.categoryId,
      sku: product.sku,
      name: product.name,
      importPrice: String(product.importPrice),
      salePrice: String(product.salePrice),
      stockQuantity:
        product.stockQuantity !== null ? String(product.stockQuantity) : "",
      description: product.description ?? "",
      imageUrl: product.imageUrl ?? "",
      isAvailable: product.isAvailable,
    });
    setImageSource(
      product.imageUrl?.startsWith("http") &&
        !product.imageUrl.includes("/uploads/products/")
        ? "url"
        : "file"
    );
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingProduct(null);
    setFormState(defaultFormState);
    setImageSource("file");
    setIsModalOpen(false);
  }

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      const response = await uploadProductImage(file);
      setFormState((current) => ({
        ...current,
        imageUrl: response.data.imageUrl,
      }));
      showNotice("Đã tải ảnh sản phẩm.", "success");
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Không tải được ảnh sản phẩm."
      );
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedCategory = categories.find(
      (category) => category.id === formState.categoryId
    );
    const isTrackedStock = selectedCategory?.isTrackedStock ?? false;

    const payload = {
      categoryId: formState.categoryId,
      sku: formState.sku.trim(),
      name: formState.name.trim(),
      isTrackedStock,
      importPrice: Number(formState.importPrice || 0),
      salePrice: Number(formState.salePrice || 0),
      stockQuantity: isTrackedStock ? Number(formState.stockQuantity || 0) : null,
      description: formState.description.trim() || null,
      imageUrl: formState.imageUrl.trim() || null,
      isAvailable: formState.isAvailable,
    };

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        showNotice("Đã lưu thay đổi sản phẩm.", "success");
      } else {
        await createProduct(payload);
        showNotice("Đã thêm sản phẩm mới.", "success");
      }

      await loadData();
      closeModal();
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Chưa lưu được sản phẩm. Vui lòng kiểm tra lại thông tin."
      );
    }
  }

  async function handleDeleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa sản phẩm "${product.name}" không?`
    );

    if (!confirmed) return;

    try {
      await deleteProduct(product.id);
      await loadData();
      showNotice("Đã xóa sản phẩm.", "success");
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Chưa xóa được sản phẩm. Vui lòng thử lại."
      );
    }
  }

  function handleExportProducts() {
    const headers = [
      "SKU",
      "Tên sản phẩm",
      "Danh mục",
      "Giá nhập",
      "Giá bán",
      "Tồn kho",
      "Mô tả",
      "Ảnh",
    ];
    const rows = filteredProducts.map((product) => [
      product.sku,
      product.name,
      product.categoryName || "",
      product.importPrice,
      product.salePrice,
      product.stockQuantity,
      product.description || "",
      product.imageUrl || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "danh-sach-san-pham.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportProducts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        throw new Error("File nhập không có dữ liệu sản phẩm.");
      }

      const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
      const headers = parseCsvLine(lines[0], delimiter).map((header) =>
        normalizeText(header)
      );
      const getCell = (values: string[], names: string[]) => {
        const index = headers.findIndex((header) =>
          names.some((name) => header === normalizeText(name))
        );

        return index >= 0 ? values[index] ?? "" : "";
      };

      for (const line of lines.slice(1)) {
        const values = parseCsvLine(line, delimiter);
        const categoryNameOrId = getCell(values, [
          "Danh mục",
          "category",
          "categoryId",
        ]);
        const category = categories.find(
          (item) =>
            item.id === categoryNameOrId ||
            normalizeText(item.name) === normalizeText(categoryNameOrId)
        );

        if (!category) {
          const validCategoryNames = categories.map((item) => `"${item.name}"`).join(", ");
          throw new Error(
            `Không tìm thấy danh mục "${categoryNameOrId}". Danh mục hợp lệ: ${validCategoryNames}.`
          );
        }

        const isTrackedStock = category.isTrackedStock;
        await createProduct({
          sku: getCell(values, ["SKU", "Mã sản phẩm"]),
          name: getCell(values, ["Tên sản phẩm", "name"]),
          categoryId: category.id,
          isTrackedStock,
          importPrice: parseImportedNumber(getCell(values, ["Giá nhập", "importPrice"])),
          salePrice: parseImportedNumber(getCell(values, ["Giá bán", "salePrice"])),
          stockQuantity: isTrackedStock
            ? parseImportedNumber(getCell(values, ["Tồn kho", "stockQuantity"]))
            : null,
          description: getCell(values, ["Mô tả", "description"]) || null,
          imageUrl: getCell(values, ["Ảnh", "imageUrl"]) || null,
        });
      }

      await loadData();
      showNotice("Đã nhập danh sách sản phẩm.", "success");
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Chưa nhập được danh sách sản phẩm."
      );
    }
  }

  const selectedCategory = categories.find(
    (category) => category.id === formState.categoryId
  );
  const isTrackedStock = selectedCategory?.isTrackedStock ?? false;

  return (
    <AdminLayout>
      {notice ? (
        <div
          className={`mb-4 flex items-start justify-between border p-4 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-4 text-lg leading-none opacity-70 hover:opacity-100"
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 xl:grid-cols-[minmax(260px,1fr)_220px_190px_auto_auto_auto_auto] xl:items-center">
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo SKU hoặc tên sản phẩm..."
              className="h-11 w-full border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none focus:border-[#f97316]"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => {
              const selectedCategoryId = event.target.value;
              const category = categories.find((item) => item.id === selectedCategoryId);
              setCategoryFilter(selectedCategoryId);
              setSearchParams(category ? { category: category.name } : {});
              setPage(1);
            }}
            className="h-11 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#f97316]"
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={availabilityFilter}
            onChange={(event) => {
              setAvailabilityFilter(event.target.value);
              setPage(1);
            }}
            className="h-11 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#f97316]"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Đang bán</option>
            <option value="low">Sắp hết hàng</option>
            <option value="unavailable">Hết hàng/ngừng bán</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategoryFilter("all");
              setAvailabilityFilter("all");
              setSearchParams({});
              setPage(1);
            }}
            className="h-11 border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            Xóa lọc
          </button>
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Icon name="upload_file" />
            Nhập CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                void handleImportProducts(event);
              }}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={handleExportProducts}
            className="inline-flex h-11 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="download" />
            Xuất CSV
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center justify-center gap-2 bg-[#f97316] px-4 text-sm font-black text-white hover:bg-[#ea580c]"
          >
            <Icon name="add" />
            Thêm sản phẩm
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm font-bold text-slate-500">
            Đang tải sản phẩm...
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4">Sản phẩm</th>
                <th className="px-5 py-4">Danh mục</th>
                <th className="px-5 py-4 text-right">Giá nhập</th>
                <th className="px-5 py-4 text-right">Giá bán</th>
                <th className="px-5 py-4 text-center">Tồn kho</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.map((product) => {
                const stockState = getStockState(product);
                return (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-14 w-14 border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center border border-slate-200 bg-slate-50 text-slate-300">
                            <Icon name="fastfood" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-black text-[#0b1c30]">
                            {product.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            SKU: {product.sku}
                          </p>
                          <p className="mt-1 max-w-[260px] truncate text-xs text-slate-400">
                            {product.description || "Chưa có mô tả"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-600">
                      {product.categoryName || "Chưa phân loại"}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-500">
                      {formatCurrency(product.importPrice)}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-[#0b1c30]">
                      {formatCurrency(product.salePrice)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {product.isTrackedStock ? (
                        <span className="font-black text-[#0b1c30]">
                          {(product.stockQuantity ?? 0).toLocaleString("vi-VN")}
                        </span>
                      ) : (
                        <span className="font-bold text-slate-400">Không quản lý</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex border px-3 py-1 text-xs font-black ${stockState.className}`}
                      >
                        {stockState.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="p-2 text-[#f97316] hover:bg-orange-50"
                          aria-label="Sửa sản phẩm"
                        >
                          <Icon name="edit" className="text-xl" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteProduct(product);
                          }}
                          className="p-2 text-rose-500 hover:bg-rose-50"
                          aria-label="Xóa sản phẩm"
                        >
                          <Icon name="delete" className="text-xl" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-slate-400">
            Không có sản phẩm phù hợp.
          </div>
        ) : null}

        <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 p-4 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-slate-500">
            Hiển thị{" "}
            <span className="font-black text-[#0b1c30]">{paginatedProducts.length}</span>{" "}
            trên{" "}
            <span className="font-black text-[#0b1c30]">{filteredProducts.length}</span>{" "}
            sản phẩm
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30"
            >
              <Icon name="chevron_left" />
            </button>
            <span className="px-3 text-sm font-black text-[#0b1c30]">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,28,48,0.45)] p-4">
          <div className="w-full max-w-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                  {editingProduct ? "Cập nhật sản phẩm" : "Sản phẩm mới"}
                </p>
                <h3 className="mt-1 text-xl font-black text-[#0b1c30]">
                  {editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng form"
              >
                <Icon name="close" />
              </button>
            </div>

            <form className="grid max-h-[78vh] gap-5 overflow-y-auto p-6 sm:grid-cols-2" onSubmit={handleSubmit}>
              <label className="space-y-2">
                <span className="block text-sm font-bold text-[#0b1c30]">
                  Tên sản phẩm <span className="text-rose-600">*</span>
                </span>
                <input
                  required
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  className="h-11 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316]"
                  placeholder="VD: Cà phê sữa"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-bold text-[#0b1c30]">
                  SKU <span className="text-rose-600">*</span>
                </span>
                <input
                  required
                  value={formState.sku}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, sku: event.target.value }))
                  }
                  className="h-11 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316]"
                  placeholder="VD: CF-SUA"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-bold text-[#0b1c30]">
                  Danh mục <span className="text-rose-600">*</span>
                </span>
                <select
                  required
                  value={formState.categoryId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  className="h-11 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316]"
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-bold text-[#0b1c30]">Giá nhập</span>
                <input
                  type="number"
                  min={0}
                  value={formState.importPrice}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      importPrice: event.target.value,
                    }))
                  }
                  className="h-11 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316]"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-bold text-[#0b1c30]">
                  Giá bán <span className="text-rose-600">*</span>
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  value={formState.salePrice}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      salePrice: event.target.value,
                    }))
                  }
                  className="h-11 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316]"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-bold text-[#0b1c30]">
                  Tồn kho {isTrackedStock ? <span className="text-rose-600">*</span> : null}
                </span>
                <input
                  type="number"
                  min={0}
                  disabled={!isTrackedStock}
                  value={isTrackedStock ? formState.stockQuantity : ""}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      stockQuantity: event.target.value,
                    }))
                  }
                  placeholder={
                    isTrackedStock ? "VD: 10" : "Danh mục này không quản lý tồn kho"
                  }
                  className="h-11 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316] disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>

              <div className="space-y-3 sm:col-span-2">
                <span className="block text-sm font-bold text-[#0b1c30]">Ảnh sản phẩm</span>
                <div className="grid grid-cols-2 border border-slate-200 p-1">
                  <button
                    type="button"
                    onClick={() => setImageSource("file")}
                    className={`h-9 text-xs font-black ${
                      imageSource === "file"
                        ? "bg-[#f97316] text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Tải từ máy
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSource("url")}
                    className={`h-9 text-xs font-black ${
                      imageSource === "url"
                        ? "bg-[#f97316] text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Nhập link ảnh
                  </button>
                </div>

                {imageSource === "file" ? (
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => {
                      void handleImageFileChange(event);
                    }}
                    className="w-full border border-slate-200 px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-xs file:font-black file:text-[#f97316]"
                  />
                ) : (
                  <input
                    type="url"
                    value={formState.imageUrl}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        imageUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="h-11 w-full border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316]"
                  />
                )}
                {isUploadingImage ? (
                  <p className="text-xs font-bold text-slate-400">Đang tải ảnh...</p>
                ) : null}
              </div>

              {formState.imageUrl.trim() ? (
                <div className="relative border border-slate-200 sm:col-span-2">
                  <img
                    src={formState.imageUrl}
                    alt="Ảnh xem trước"
                    className="h-44 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((current) => ({ ...current, imageUrl: "" }))
                    }
                    className="absolute right-3 top-3 bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700"
                  >
                    Xóa ảnh
                  </button>
                </div>
              ) : null}

              <label className="space-y-2 sm:col-span-2">
                <span className="block text-sm font-bold text-[#0b1c30]">Mô tả</span>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="w-full resize-none border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#f97316]"
                  placeholder="Mô tả ngắn về món bán..."
                />
              </label>

              <label className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={formState.isAvailable}
                  onChange={(event) =>
                    setFormState((current) => ({
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

              <div className="flex gap-3 border-t border-slate-200 pt-5 sm:col-span-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 flex-1 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex h-10 flex-1 items-center justify-center bg-[#f97316] px-4 text-sm font-black text-white hover:bg-[#ea580c]"
                >
                  {editingProduct ? "Lưu thay đổi" : "Thêm sản phẩm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default ProductPage;
