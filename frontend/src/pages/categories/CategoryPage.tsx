import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  uploadCategoryImage,
  type Category as ApiCategory,
} from "../../api/category.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";

type CategoryLogicType = "prepared" | "stock_returnable";
type LogicFilter = "all" | CategoryLogicType;
type ProductFilter = "all" | "has_products" | "empty";
type NoticeState = {
  type: "success" | "error";
  message: string;
};

type CategoryFormState = {
  name: string;
  description: string;
  imageUrl: string;
  logicType: CategoryLogicType;
};

const defaultFormState: CategoryFormState = {
  name: "",
  description: "",
  imageUrl: "",
  logicType: "prepared",
};

function getCategoryLogicType(category: ApiCategory): CategoryLogicType {
  return category.isTrackedStock ? "stock_returnable" : "prepared";
}

function getLogicMeta(logicType: CategoryLogicType) {
  if (logicType === "stock_returnable") {
    return {
      label: "Hàng bán có số lượng",
      description: "Dùng cho sản phẩm có sẵn như nước lon, nước chai hoặc hàng đóng gói.",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      icon: "inventory_2",
    };
  }

  return {
    label: "Món pha chế / chế biến",
    description: "Dùng cho món được pha chế hoặc chế biến sau khi khách đặt.",
    className: "bg-orange-50 text-[#f97316] ring-orange-100",
    icon: "local_cafe",
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
  tone: string;
}) {
  return (
    <article className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-[#0b1c30]">{value}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center ${tone}`}>
          <Icon name={icon} />
        </span>
      </div>
    </article>
  );
}

function CategoryPage() {
  const { confirm: confirmAction } = useAppNotifications();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [search, setSearch] = useState("");
  const [logicFilter, setLogicFilter] = useState<LogicFilter>("all");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>(defaultFormState);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const pageSize = 8;

  const loadCategories = useCallback(async () => {
    try {
      setNotice(null);
      const response = await getCategories();
      setCategories(response.data);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Không tải được danh sách danh mục.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCategories);
  }, [loadCategories]);

  useEffect(() => {
    if (!isModalOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const stats = useMemo(
    () => [
      {
        label: "Tổng danh mục",
        value: String(categories.length),
        icon: "category",
        tone: "bg-orange-50 text-[#f97316]",
      },
      {
        label: "Có sản phẩm",
        value: String(categories.filter((category) => category.productCount > 0).length),
        icon: "package_2",
        tone: "bg-sky-50 text-sky-700",
      },
      {
        label: "Có theo dõi số lượng",
        value: String(categories.filter((category) => category.isTrackedStock).length),
        icon: "inventory_2",
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Chưa có sản phẩm",
        value: String(categories.filter((category) => category.productCount === 0).length),
        icon: "remove_shopping_cart",
        tone: "bg-slate-100 text-slate-600",
      },
    ],
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    return categories.filter((category) => {
      const logicType = getCategoryLogicType(category);
      const description = category.description ?? "";
      const matchesSearch =
        query.length === 0 ||
        category.name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query);
      const matchesLogic = logicFilter === "all" || logicFilter === logicType;
      const matchesProduct =
        productFilter === "all" ||
        (productFilter === "has_products" && category.productCount > 0) ||
        (productFilter === "empty" && category.productCount === 0);

      return matchesSearch && matchesLogic && matchesProduct;
    });
  }, [categories, logicFilter, productFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const paginatedCategories = filteredCategories.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const resetFilters = () => {
    setSearch("");
    setLogicFilter("all");
    setProductFilter("all");
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormState(defaultFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (category: ApiCategory) => {
    setEditingCategory(category);
    setFormState({
      name: category.name,
      description: category.description ?? "",
      imageUrl: category.imageUrl ?? "",
      logicType: getCategoryLogicType(category),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormState(defaultFormState);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      imageUrl: formState.imageUrl.trim() || null,
      isTrackedStock: formState.logicType === "stock_returnable",
    };

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, payload);
      } else {
        await createCategory(payload);
      }

      await loadCategories();
      closeModal();
      setNotice({
        type: "success",
        message: editingCategory
          ? "Đã cập nhật danh mục."
          : "Đã thêm danh mục mới.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Không lưu được danh mục.",
      });
    }
  };

  const handleDeleteCategory = async (category: ApiCategory) => {
    const confirmDelete = await confirmAction({
      title: "Xóa danh mục",
      message: `Xóa danh mục "${category.name}"? Chỉ xóa được khi danh mục chưa có sản phẩm.`,
      confirmText: "Xóa",
      type: "warning",
    });

    if (!confirmDelete) {
      return;
    }

    try {
      await deleteCategory(category.id);
      await loadCategories();
      setNotice({ type: "success", message: "Đã xóa danh mục." });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Không xóa được danh mục.",
      });
    }
  };

  const handleImageFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploadingImage(true);
      const response = await uploadCategoryImage(file);
      setFormState((current) => ({
        ...current,
        imageUrl: response.data.imageUrl,
      }));
      setNotice({ type: "success", message: "Đã tải ảnh danh mục." });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Không tải được ảnh danh mục.",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <AdminLayout
      title="Quản lý danh mục"
      subtitle="Phân loại sản phẩm theo nhóm để dễ dàng tìm kiếm và quản lý."
    >
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </section>

        {notice ? (
          <div
            className={[
              "flex items-start gap-3 border px-4 py-3 text-sm font-semibold",
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            ].join(" ")}
          >
            <Icon name={notice.type === "success" ? "check_circle" : "error"} />
            <span>{notice.message}</span>
          </div>
        ) : null}

        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Icon
                  name="search"
                  className="absolute left-3 top-1/2 text-[20px] text-slate-400 -translate-y-1/2"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm tên danh mục hoặc mô tả..."
                  className="h-11 w-full border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-[#0b1c30] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <select
                value={logicFilter}
                onChange={(event) => {
                  setLogicFilter(event.target.value as LogicFilter);
                  setPage(1);
                }}
                className="h-11 border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0b1c30] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
              >
                <option value="all">Tất cả cách bán hàng</option>
                <option value="prepared">Món pha chế / chế biến</option>
                <option value="stock_returnable">Hàng bán có số lượng</option>
              </select>

              <select
                value={productFilter}
                onChange={(event) => {
                  setProductFilter(event.target.value as ProductFilter);
                  setPage(1);
                }}
                className="h-11 border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0b1c30] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
              >
                <option value="all">Tất cả trạng thái sử dụng</option>
                <option value="has_products">Đã có sản phẩm</option>
                <option value="empty">Chưa có sản phẩm</option>
              </select>

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-11 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <Icon name="filter_alt_off" className="text-[20px]" />
                Xóa lọc
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-11 items-center justify-center gap-2 bg-[#f97316] px-5 text-sm font-bold text-white transition hover:bg-[#ea580c]"
              >
                <Icon name="add" className="text-[20px]" />
                Thêm danh mục
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Danh mục</th>
                  <th className="px-5 py-3">Cách bán hàng</th>
                  <th className="px-5 py-3 text-center">Số sản phẩm</th>
                  <th className="px-5 py-3">Ngày tạo</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center font-semibold text-slate-500">
                      Đang tải danh mục...
                    </td>
                  </tr>
                ) : null}

                {!isLoading && paginatedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center font-semibold text-slate-500">
                      Không tìm thấy danh mục phù hợp.
                    </td>
                  </tr>
                ) : null}

                {!isLoading
                  ? paginatedCategories.map((category) => {
                      const logicType = getCategoryLogicType(category);
                      const logicMeta = getLogicMeta(logicType);

                      return (
                        <tr key={category.id} className="transition hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {category.imageUrl ? (
                                <img
                                  src={category.imageUrl}
                                  alt={category.name}
                                  className="h-12 w-12 object-cover ring-1 ring-slate-200"
                                />
                              ) : (
                                <span className="flex h-12 w-12 items-center justify-center bg-orange-50 text-[#f97316] ring-1 ring-orange-100">
                                  <Icon name="category" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-extrabold text-[#0b1c30]">
                                  {category.name}
                                </p>
                                <p className="mt-1 max-w-md truncate text-xs font-medium text-slate-500">
                                  {category.description || "Chưa có mô tả"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold ring-1 ${logicMeta.className}`}
                            >
                              <Icon name={logicMeta.icon} className="text-[16px]" />
                              {logicMeta.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center font-extrabold text-[#0b1c30]">
                            {category.productCount}
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-600">
                            {new Date(category.createdAt).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/products?category=${encodeURIComponent(category.name)}`
                                  )
                                }
                                className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-sky-700 transition hover:bg-sky-50"
                                aria-label="Xem sản phẩm trong danh mục"
                                title="Xem sản phẩm trong danh mục"
                              >
                                <Icon name="visibility" className="text-[20px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(category)}
                                className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-[#f97316] transition hover:bg-orange-50"
                                aria-label="Sửa danh mục"
                                title="Sửa danh mục"
                              >
                                <Icon name="edit" className="text-[20px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteCategory(category);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-rose-600 transition hover:bg-rose-50"
                                aria-label="Xóa danh mục"
                                title="Xóa danh mục"
                              >
                                <Icon name="delete" className="text-[20px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-500">
              Hiển thị{" "}
              <span className="text-[#0b1c30]">{paginatedCategories.length}</span>{" "}
              trên <span className="text-[#0b1c30]">{filteredCategories.length}</span>{" "}
              danh mục
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang trước"
              >
                <Icon name="chevron_left" />
              </button>
              <span className="px-2 text-sm font-bold text-[#0b1c30]">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang sau"
              >
                <Icon name="chevron_right" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/45 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center bg-orange-50 text-[#f97316]">
                  <Icon name="category" />
                </span>
                <div>
                  <h3 className="text-lg font-extrabold text-[#0b1c30]">
                    {editingCategory ? "Sửa danh mục" : "Thêm danh mục mới"}
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    Danh mục dùng để nhóm món bán và chọn cách quản lý phù hợp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-slate-500 transition hover:text-rose-600"
                aria-label="Đóng form"
              >
                <Icon name="close" />
              </button>
            </div>

            <form className="space-y-5 p-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Tên danh mục <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Cà phê"
                    className="h-11 w-full border border-slate-200 px-3 text-sm font-semibold text-[#0b1c30] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Cách bán hàng <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formState.logicType}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        logicType: event.target.value as CategoryLogicType,
                      }))
                    }
                    className="h-11 w-full border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0b1c30] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="prepared">Món pha chế / chế biến</option>
                    <option value="stock_returnable">Hàng bán có số lượng</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Mô tả
                </label>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Ghi chú ngắn về nhóm món này..."
                  className="w-full resize-none border border-slate-200 px-3 py-3 text-sm font-medium text-[#0b1c30] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Ảnh danh mục
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => {
                      void handleImageFileChange(event);
                    }}
                    className="w-full border border-slate-200 px-3 py-2 text-sm font-semibold text-[#0b1c30] file:mr-3 file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#f97316] focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="text-xs font-medium text-slate-500">
                    {isUploadingImage
                      ? "Đang tải ảnh lên máy chủ..."
                      : getLogicMeta(formState.logicType).description}
                  </p>
                </div>

                <div className="flex h-32 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50">
                  {formState.imageUrl.trim() ? (
                    <img
                      src={formState.imageUrl}
                      alt="Ảnh xem trước"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Icon name="image" className="text-3xl text-slate-300" />
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-11 items-center justify-center border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center bg-[#f97316] px-6 text-sm font-bold text-white transition hover:bg-[#ea580c]"
                >
                  {editingCategory ? "Lưu thay đổi" : "Thêm danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default CategoryPage;
