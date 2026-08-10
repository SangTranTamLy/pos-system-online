import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { getCategories, type Category } from "../../api/category.api";
import {
  createProduct,
  deleteProduct,
  getProducts,
  type Product,
} from "../../api/product.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";
import ProductConfigurationModal from "../../components/products/ProductConfigurationModal";
import Pagination from "../../components/common/Pagination";





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
  return {
    label: product.isAvailable ? "Đang bán" : "Ngừng bán",
    className: product.isAvailable
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-slate-50 text-slate-500 border-slate-200",
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
  const { notify, confirm: confirmAction } = useAppNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryQuery = searchParams.get("category") ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null);
  const [csvAction, setCsvAction] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const showNotice = useCallback((message: string, type: "success" | "error" = "error") => {
    notify(message, type);
  }, [notify]);

  const loadData = useCallback(async () => {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      const loadedCategories = categoriesResponse.data;

      setProducts(productsResponse.data);
      setCategories(loadedCategories);
      setPage(1);

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
    void Promise.resolve().then(() => void loadData());
  }, [loadData]);



  const stats = useMemo(() => {
    const availableCount = products.filter((product) => product.isAvailable).length;
    const pausedCount = products.filter((product) => !product.isAvailable).length;

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
        label: "Danh mục",
        value: String(categories.length),
        icon: "category",
        tone: "blue" as const,
      },
      {
        label: "Ngừng bán",
        value: String(pausedCount),
        icon: "pause_circle",
        tone: "rose" as const,
      },
    ];
  }, [categories.length, products]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(search);

    return products.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.sku).includes(query);
      const matchesCategory =
        categoryFilter === "all" || product.categoryId === categoryFilter;
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && product.isAvailable) ||
        (availabilityFilter === "unavailable" && !product.isAvailable);

      return matchesSearch && matchesCategory && matchesAvailability;
    });
  }, [availabilityFilter, categoryFilter, products, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function openCreateModal() {
    setConfiguringProduct(null);
    setIsConfiguring(true);
  }

  function openEditModal(product: Product) {
    setConfiguringProduct(product);
    setIsConfiguring(true);
  }

  async function handleDeleteProduct(product: Product) {
    const confirmed = await confirmAction({
      title: "Xóa sản phẩm",
      message: `Bạn có chắc chắn muốn xóa sản phẩm "${product.name}" không?`,
      confirmText: "Xóa",
      type: "warning",
    });

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
      "Mô tả",
      "Ảnh",
    ];
    const rows = filteredProducts.map((product) => [
      product.sku,
      product.name,
      product.categoryName || "",
      product.importPrice,
      product.salePrice,
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

  function handleCsvActionChange(event: ChangeEvent<HTMLSelectElement>) {
    const action = event.target.value;
    setCsvAction("");

    if (action === "import") {
      csvInputRef.current?.click();
      return;
    }

    if (action === "export") {
      handleExportProducts();
    }
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

        await createProduct({
          sku: getCell(values, ["SKU", "Mã sản phẩm"]),
          name: getCell(values, ["Tên sản phẩm", "name"]),
          categoryId: category.id,
          importPrice: parseImportedNumber(getCell(values, ["Giá nhập", "importPrice"])),
          salePrice: parseImportedNumber(getCell(values, ["Giá bán", "salePrice"])),
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

  return (
    <AdminLayout
      title="Sản phẩm"
      subtitle="Quản lý danh sách sản phẩm, giá bán, danh mục và trạng thái kinh doanh."
    >


      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 xl:grid-cols-[minmax(260px,1fr)_220px_190px_auto_auto_auto] xl:items-center">
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
            <option value="unavailable">Ngừng bán</option>
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
          <div className="relative">
            <Icon
              name="description"
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[20px] text-slate-600"
            />
            <select
              value={csvAction}
              onChange={handleCsvActionChange}
              aria-label="Thao tác CSV"
              className="h-11 w-full appearance-none border border-slate-200 bg-white py-2 pl-10 pr-9 text-sm font-bold text-slate-700 outline-none transition hover:bg-slate-50 focus:border-[#f97316]"
            >
              <option value="">CSV</option>
              <option value="import">Nhập CSV</option>
              <option value="export">Xuất CSV</option>
            </select>
            <Icon
              name="expand_more"
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[20px] text-slate-500"
            />
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                void handleImportProducts(event);
              }}
              className="hidden"
            />
          </div>
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
          <table className="w-full min-w-260 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4">Sản phẩm</th>
                <th className="px-5 py-4">Danh mục</th>
                <th className="px-5 py-4 text-right">Giá nhập</th>
                <th className="px-5 py-4 text-right">Giá bán</th>
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
                          <p className="mt-1 max-w-65 truncate text-xs text-slate-400">
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
                          className="p-2 text-sky-600 hover:bg-sky-50"
                          aria-label="Thiết kế món"
                          title="Sửa và thiết kế món"
                        >
                          <Icon name="restaurant_menu" className="text-xl" />
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

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredProducts.length}
          pageSize={pageSize}
          onPageChange={setPage}
          itemName="sản phẩm"
        />
      </section>

      {isConfiguring ? (
        <ProductConfigurationModal
          product={configuringProduct}
          products={products}
          categories={categories}
          onClose={() => setIsConfiguring(false)}
          onSaved={() => {
            void loadData();
            showNotice("Đã lưu thông tin sản phẩm và cấu hình món.", "success");
          }}
        />
      ) : null}
    </AdminLayout>
  );
}

export default ProductPage;
