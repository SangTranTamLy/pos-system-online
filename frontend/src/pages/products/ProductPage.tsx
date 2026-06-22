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
import { FilterBar } from "../../components/common/FilterBar";

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

function ProductStatCard({
  label,
  value,
  icon,
  accentClassName = "text-[#9d4300]",
}: {
  label: string;
  value: string;
  icon: string;
  accentClassName?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-xl bg-slate-50 p-3 ${accentClassName}`}>
          <Icon name={icon} />
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-tight text-slate-500">{label}</p>
      <h3 className="mt-1 text-2xl font-extrabold text-[#2a1b14]">{value}</h3>
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
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(defaultFormState);
  const [imageSource, setImageSource] = useState<"file" | "url">("file");

  // Removed recipe modal states

  const loadData = useCallback(async () => {
    try {
      setErrorMessage("");

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
      setErrorMessage(error instanceof Error ? error.message : "Không tải được dữ liệu sản phẩm");
    } finally {
      setIsLoading(false);
    }
  }, [categoryQuery]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  useEffect(() => {
    if (!showToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowToast(false);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showToast]);

  const pageSize = 6;

  const stats = useMemo(() => {
    const availableCount = products.filter((product) =>
      product.isTrackedStock
        ? (product.stockQuantity !== null && product.stockQuantity > 0)
        : product.isAvailable
    ).length;
    const outOfStockCount = products.filter((product) =>
      product.isTrackedStock
        ? (product.stockQuantity === null || product.stockQuantity <= 0)
        : !product.isAvailable
    ).length;
    const lowStockCount = products.filter((product) =>
      product.isTrackedStock && product.stockQuantity !== null && product.stockQuantity > 0 && product.stockQuantity <= 10
    ).length;

    return [
      { label: "Tổng sản phẩm", value: String(products.length), icon: "package_2" },
      {
        label: "Còn hàng",
        value: String(availableCount),
        icon: "check_circle",
        accentClassName: "text-green-600",
      },
      {
        label: "Sắp hết hàng",
        value: String(lowStockCount),
        icon: "warning",
        accentClassName: "text-amber-500",
      },
      {
        label: "Hết hàng",
        value: String(outOfStockCount),
        icon: "error",
        accentClassName: "text-red-600",
      },
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "all" || product.categoryId === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, products, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormState({
      ...defaultFormState,
      categoryId: categories[0]?.id ?? "",
      isAvailable: true,
    });
    setImageSource("file");
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormState({
      categoryId: product.categoryId,
      sku: product.sku,
      name: product.name,
      importPrice: String(product.importPrice),
      salePrice: String(product.salePrice),
      stockQuantity: product.stockQuantity !== null ? String(product.stockQuantity) : "",
      description: product.description ?? "",
      imageUrl: product.imageUrl ?? "",
      isAvailable: product.isAvailable,
    });
    const hasExternalImage = product.imageUrl &&
      product.imageUrl.trim().startsWith("http") &&
      !product.imageUrl.includes("/uploads/products/");
    setImageSource(hasExternalImage ? "url" : "file");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingProduct(null);
    setFormState(defaultFormState);
    setImageSource("file");
    setIsModalOpen(false);
  };

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploadingImage(true);
      setErrorMessage("");

      const response = await uploadProductImage(file);

      setFormState((current) => ({
        ...current,
        imageUrl: response.data.imageUrl,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tải ảnh sản phẩm thất bại");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setErrorMessage("");

      const selectedCategory = categories.find((c) => c.id === formState.categoryId);
      const isTrackedStock = selectedCategory ? selectedCategory.isTrackedStock : false;

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

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await createProduct(payload);
      }

      await loadData();
      closeModal();
      setShowToast(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Lưu sản phẩm thất bại");
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmDelete = window.confirm(`Bạn có chắc muốn xóa sản phẩm "${product.name}" không?`);

    if (!confirmDelete) {
      return;
    }

    try {
      setErrorMessage("");
      await deleteProduct(product.id);
      await loadData();
      setShowToast(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Xóa sản phẩm thật bại");
    }
  };

  const handleExportProducts = () => {
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
  };

  const handleImportProducts = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setErrorMessage("");

      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        throw new Error("File nhập không có dữ liệu sản phẩm");
      }

      const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
      const headers = parseCsvLine(lines[0], delimiter).map((header) => normalizeText(header));
      const getCell = (values: string[], names: string[]) => {
        const index = headers.findIndex((header) =>
          names.some((name) => header === normalizeText(name))
        );

        return index >= 0 ? values[index] ?? "" : "";
      };

      for (const line of lines.slice(1)) {
        const values = parseCsvLine(line, delimiter);
        const categoryNameOrId = getCell(values, ["Danh mục", "category", "categoryId"]);
        const category = categories.find(
          (item) =>
            item.id === categoryNameOrId ||
            normalizeText(item.name) === normalizeText(categoryNameOrId)
        );

        if (!category) {
          const validCategoryNames = categories.map((c) => `"${c.name}"`).join(", ");
          throw new Error(
            `Không tìm thấy danh mục: "${categoryNameOrId}". Các danh mục hợp lệ trong hệ thống: ${validCategoryNames}. Vui lòng kiểm tra lại chính tả hoặc mã hóa (encoding) của file CSV.`
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
          stockQuantity: isTrackedStock ? parseImportedNumber(getCell(values, ["Tồn kho", "stockQuantity"])) : null,
          description: getCell(values, ["Mô tả", "description"]) || null,
          imageUrl: getCell(values, ["Ảnh", "imageUrl"]) || null,
        });
      }

      await loadData();
      setShowToast(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nhập danh sách thất bại");
    }
  };

  return (
    <AdminLayout
      title="Quản lý sản phẩm"
      subtitle="Quản lý món ăn sáng, nước uống, giá bán và tồn kho tại cửa hàng."
    >
      <section className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#9d4300]">
            Kho thực đơn
          </p>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[#2a1b14]">
            Sản phẩm bán tại cửa hàng
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Theo dõi danh sách món, giá nhập, giá bán và số lượng tồn kho.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
            <Icon name="upload_file" />
            Nhập Excel
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
            className="inline-flex h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Icon name="download" />
            Xuất danh sách
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center justify-center gap-2 bg-[#9d4300] px-4 text-sm font-bold text-white transition-colors hover:bg-[#803600]"
          >
            <Icon name="add" />
            Thêm sản phẩm
          </button>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <ProductStatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <FilterBar
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Tìm theo SKU hoặc tên sản phẩm..."
          onClear={() => {
            setSearch("");
            setCategoryFilter("all");
            setSearchParams({});
            setPage(1);
          }}
          className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_220px_auto] lg:items-center"
        >
          <select
            value={categoryFilter}
            onChange={(event) => {
              const selectedCategoryId = event.target.value;
              const selectedCategory = categories.find(
                (category) => category.id === selectedCategoryId
              );

              setCategoryFilter(selectedCategoryId);
              setSearchParams(
                selectedCategory ? { category: selectedCategory.name } : {}
              );
              setPage(1);
            }}
            className="h-[46px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FilterBar>

        {isLoading ? (
          <div className="p-6 text-sm font-medium text-slate-500">Đang tải sản phẩm...</div>
        ) : null}
        {errorMessage ? (
          <div className="p-6 text-sm font-semibold text-red-600">{errorMessage}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Hình ảnh</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Tên sản phẩm</th>
                <th className="px-6 py-4">Danh mục</th>
                <th className="px-6 py-4 text-right">Giá nhập</th>
                <th className="px-6 py-4 text-right">Giá bán</th>
                <th className="px-6 py-4 text-center">Tồn kho</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-14 w-14 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-[#9d4300]">
                        <Icon name="fastfood" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-500">{product.sku}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#2a1b14]">{product.name}</p>
                      {!product.isAvailable ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                          Ngừng bán
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 max-w-[220px] truncate text-xs text-slate-400">
                      {product.description || "Chưa có mô tả"}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {product.categoryName || "Chưa phân loại"}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500">
                    {formatCurrency(product.importPrice)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[#9d4300]">
                    {formatCurrency(product.salePrice)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {product.isTrackedStock ? (
                      <span
                        className={[
                          "font-bold",
                          product.stockQuantity === null || product.stockQuantity <= 0
                            ? "text-red-600"
                            : product.stockQuantity <= 10
                              ? "text-amber-600"
                              : "text-[#2a1b14]",
                        ].join(" ")}
                      >
                        {product.stockQuantity}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">Không quản lý</span>
                    )}
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      className="rounded-lg p-2 text-[#9d4300] transition-colors hover:bg-orange-50"
                      aria-label="Sửa sản phẩm"
                    >
                      <Icon name="edit" className="text-xl" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteProduct(product);
                      }}
                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                      aria-label="Xóa sản phẩm"
                    >
                      <Icon name="delete" className="text-xl" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Hiển thị <span className="font-bold text-[#2a1b14]">{paginatedProducts.length}</span>{" "}
            trên <span className="font-bold text-[#2a1b14]">{filteredProducts.length}</span>{" "}
            sản phẩm
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-50 disabled:opacity-30"
            >
              <Icon name="chevron_left" />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                  page === pageNumber
                    ? "bg-[#9d4300] font-bold text-white"
                    : "text-[#2a1b14] hover:bg-slate-50",
                ].join(" ")}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-50 disabled:opacity-30"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,28,48,0.45)] p-4 backdrop-blur-[4px]">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-orange-50 p-2 text-[#9d4300]">
                  <Icon name="package_2" />
                </span>
                <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-[#2a1b14]">
                  {editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 text-slate-500 transition-colors hover:text-red-600"
                aria-label="Đóng form"
              >
                <Icon name="close" className="text-2xl" />
              </button>
            </div>

            <form className="grid gap-5 p-6 sm:grid-cols-2" onSubmit={handleSubmit}>
              <label className="space-y-2">
                <span className="block text-sm font-semibold text-[#2a1b14]">
                  Tên sản phẩm <span className="text-red-600">*</span>
                </span>
                <input
                  required
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: Bánh mì thịt"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold text-[#2a1b14]">
                  SKU <span className="text-red-600">*</span>
                </span>
                <input
                  required
                  value={formState.sku}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, sku: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: BM001"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold text-[#2a1b14]">Danh mục</span>
                <select
                  required
                  value={formState.categoryId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
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
                <span className="block text-sm font-semibold text-[#2a1b14]">Giá nhập</span>
                <input
                  type="number"
                  min={0}
                  value={formState.importPrice}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, importPrice: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold text-[#2a1b14]">
                  Giá bán <span className="text-red-600">*</span>
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  value={formState.salePrice}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, salePrice: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                />
              </label>

              {(() => {
                const selectedCat = categories.find((c) => c.id === formState.categoryId);
                const isTracked = selectedCat ? selectedCat.isTrackedStock : false;
                return (
                  <label className="space-y-2">
                    <span className="block text-sm font-semibold text-[#2a1b14]">
                      Tồn kho {isTracked ? <span className="text-red-600">*</span> : ""}
                    </span>
                    <input
                      type="number"
                      min={0}
                      disabled={!isTracked}
                      value={isTracked ? formState.stockQuantity : ""}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          stockQuantity: event.target.value,
                        }))
                      }
                      placeholder={isTracked ? "VD: 10" : "Tự chế biến (Không quản lý kho)"}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </label>
                );
              })()}

              <div className="flex items-center gap-3 sm:col-span-2 py-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formState.isAvailable}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        isAvailable: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 rounded border-slate-300 text-[#9d4300] focus:ring-[#9d4300]"
                  />
                  <span className="text-sm font-semibold text-[#2a1b14]">
                    Còn bán (Cho phép hiển thị và đặt đơn tại POS)
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-semibold text-[#2a1b14]">Ảnh sản phẩm</span>
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setImageSource("file")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${imageSource === "file"
                      ? "bg-white text-[#9d4300] shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    Tải từ máy
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSource("url")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${imageSource === "url"
                      ? "bg-white text-[#9d4300] shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    Nhập link ảnh
                  </button>
                </div>

                {imageSource === "file" ? (
                  <div className="space-y-1">
                    <input
                      key="file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => {
                        void handleImageFileChange(event);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-[#9d4300] file:hover:bg-orange-100 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-500">
                      {isUploadingImage ? "Đang tải ảnh lên..." : "Chọn ảnh định dạng JPG, PNG, WEBP, GIF."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      key="url-input"
                      type="url"
                      value={formState.imageUrl}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, imageUrl: event.target.value }))
                      }
                      placeholder="Nhập link ảnh (https://...)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                    />
                    <p className="text-[11px] text-slate-500">
                      Nhập đường dẫn trực tiếp đến hình ảnh trên internet.
                    </p>
                  </div>
                )}
              </div>

              {formState.imageUrl.trim() ? (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 sm:col-span-2 group">
                  <img
                    src={formState.imageUrl}
                    alt="Ảnh xem trước"
                    className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <button
                    type="button"
                    onClick={() => setFormState((current) => ({ ...current, imageUrl: "" }))}
                    className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm transition-all duration-200 cursor-pointer"
                  >
                    <Icon name="delete" className="text-sm" />
                    Xóa ảnh
                  </button>
                </div>
              ) : null}

              <label className="space-y-2 sm:col-span-2">
                <span className="block text-sm font-semibold text-[#2a1b14]">Mô tả</span>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, description: event.target.value }))
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                  placeholder="Mô tả ngắn về món ăn hoặc nước uống..."
                />
              </label>

              <div className="flex gap-3 border-t border-slate-200 pt-5 sm:col-span-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 flex-1 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex h-10 flex-1 items-center justify-center bg-[#9d4300] px-4 text-sm font-bold text-white transition-colors hover:bg-[#803600]"
                >
                  {editingProduct ? "Lưu thay đổi" : "Lưu sản phẩm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Removed recipe modal */}

      {showToast ? (
        <div className="pointer-events-none fixed right-8 bottom-8 z-[60]">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
              <Icon name="check" className="text-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2a1b14]">Dữ liệu đã được cập nhật</p>
              <p className="text-[10px] text-slate-500">Sản phẩm đã được cập nhật</p>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default ProductPage;
