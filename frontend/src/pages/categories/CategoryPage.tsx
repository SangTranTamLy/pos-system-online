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

type CategoryStatCard = {
  label: string;
  value: string;
  icon: string;
  iconBg: string;
  iconText: string;
};

const baseStatCards: CategoryStatCard[] = [
  {
    label: "Tổng danh mục",
    value: "0",
    icon: "folder_zip",
    iconBg: "bg-orange-50",
    iconText: "text-[#f97316]",
  },
  {
    label: "Đang hoạt động",
    value: "0",
    icon: "check_circle",
    iconBg: "bg-green-50",
    iconText: "text-green-600",
  },
];

const defaultFormState = {
  name: "",
  description: "",
  imageUrl: "",
  displayOrder: "1",
  logicType: "prepared" as CategoryLogicType,
  requiresPreparation: true,
  isStockReturnable: false,
};
type CategoryLogicType = "prepared" | "stock_returnable";

function getCategoryLogicType(category: { /**fix logic xử lý tồn kho */
  requiresPreparation: boolean;
  isStockReturnable: boolean;
}): CategoryLogicType {
  if (category.isStockReturnable) {
    return "stock_returnable";
  }

  return "prepared";
}
function CategoryStatCard({ card }: { card: CategoryStatCard }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className={`rounded-lg p-2 ${card.iconBg} ${card.iconText}`}>
          <Icon name={card.icon} className="scale-90" />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-tight text-slate-500">
        {card.label}
      </p>
      <h3 className="mt-1 text-xl font-bold text-[#0b1c30]">{card.value}</h3>
    </article>
  );
}

function CategoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formState, setFormState] = useState(defaultFormState);

  const loadCategories = useCallback(async () => {
    try {
      setErrorMessage("");
      const response = await getCategories();
      setCategories(response.data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không tải được danh mục"
      );
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
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!showToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowToast(false);
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showToast]);

  const pageSize = 5;

  const categoryStats = useMemo(() => {
    return [
      { ...baseStatCards[0], value: String(categories.length) },
      {
        ...baseStatCards[1],
        label: "Có sản phẩm",
        value: String(categories.filter((category) => category.productCount > 0).length),
        icon: "package_2",
        iconBg: "bg-blue-50",
        iconText: "text-blue-600",
      },
    ];
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    return categories.filter((category) => {
      const description = category.description ?? "";
      const matchesSearch =
        query.length === 0 ||
        category.name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query);
      return matchesSearch;
    });
  }, [categories, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const paginatedCategories = filteredCategories.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormState(defaultFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (category: ApiCategory) => {
    const logicType = getCategoryLogicType(category);

    setEditingCategory(category);
    setFormState({
      name: category.name,
      description: category.description ?? "",
      imageUrl: category.imageUrl ?? "",
      displayOrder: "1",
      logicType,
      requiresPreparation: logicType === "prepared",
      isStockReturnable: logicType === "stock_returnable",
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormState(defaultFormState);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setErrorMessage("");

      const isPrepared = formState.logicType === "prepared";

      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        imageUrl: formState.imageUrl.trim() || null,
        requiresPreparation: isPrepared,
        isStockReturnable: !isPrepared,
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, payload);
      } else {
        await createCategory(payload);
      }

      await loadCategories();
      setIsModalOpen(false);
      setEditingCategory(null);
      setShowToast(true);
      setFormState(defaultFormState);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Lưu danh mục thất bại");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const confirmDelete = window.confirm(
      "Bạn có chắc muốn xóa danh mục này không?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      setErrorMessage("");
      await deleteCategory(categoryId);
      await loadCategories();
      setShowToast(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Xóa danh mục thất bại");
    }
  };

  const handleViewCategoryProducts = (category: ApiCategory) => {
    navigate(`/products?category=${encodeURIComponent(category.name)}`);
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
      setErrorMessage("");
      const response = await uploadCategoryImage(file);

      setFormState((current) => ({
        ...current,
        imageUrl: response.data.imageUrl,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tải ảnh thất bại");
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
      <AdminLayout
        title="Quản lý danh mục"
        subtitle="Tạo và quản lý nhóm sản phẩm trong hệ thống POS."
      >
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categoryStats.map((card) => (
          <CategoryStatCard key={card.label} card={card} />
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-stretch justify-between gap-4 border-b border-slate-200 bg-white p-4 md:flex-row md:items-center">
          <div className="flex w-full flex-1 flex-col gap-4 md:flex-row md:items-center">
            <div className="relative w-full max-w-md">
              <Icon
                name="search"
                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm kiếm danh mục..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
              />
            </div>

          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center justify-center gap-2 bg-[#f97316] px-4 text-sm font-bold text-white transition-colors hover:bg-[#ea580c]"
          >
            <Icon name="add" />
            Thêm danh mục
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm font-medium text-slate-500">
            Đang tải danh mục...
          </div>
        ) : null}
        {errorMessage ? (
          <div className="p-6 text-sm font-semibold text-red-600">{errorMessage}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-230 text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Tên danh mục</th>
                <th className="px-6 py-3">Mô tả</th>
                <th className="px-6 py-3 text-center">Số SP</th>
                <th className="px-6 py-3">Ngày tạo</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedCategories.map((category) => (
                  <tr key={category.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {category.imageUrl ? (
                          <img
                            src={category.imageUrl}
                            alt={category.name}
                            className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 text-[#f97316]">
                            <Icon name="restaurant" />
                          </div>
                        )}
                        <span className="font-bold text-[#0b1c30]">
                          {category.name}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-60 truncate px-6 py-4 text-slate-600">
                      {category.description || "Chưa có mô tả"}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-[#0b1c30]">
                      {category.productCount}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(category.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="space-x-2 px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleViewCategoryProducts(category)}
                      className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                      aria-label="Xem sản phẩm trong danh mục"
                      title="Xem sản phẩm trong danh mục"
                    >
                      <Icon name="package_2" className="text-xl" />
                    </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(category)}
                        className="rounded-lg p-2 text-[#f97316] transition-colors hover:bg-orange-50"
                        aria-label="Sửa danh mục"
                      >
                        <Icon name="edit" className="text-xl" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteCategory(category.id);
                        }}
                        className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                        aria-label="Xóa danh mục"
                      >
                        <Icon name="delete" className="text-xl" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Hiển thị{" "}
            <span className="font-bold text-[#0b1c30]">
              {paginatedCategories.length}
            </span>{" "}
            trên{" "}
            <span className="font-bold text-[#0b1c30]">
              {filteredCategories.length}
            </span>{" "}
            danh mục
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
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                    page === pageNumber
                      ? "bg-[#f97316] font-bold text-white"
                      : "text-[#0b1c30] hover:bg-slate-50",
                  ].join(" ")}
                >
                  {pageNumber}
                </button>
              )
            )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.4)] p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-orange-50 p-2 text-[#f97316]">
                  <Icon name="category" />
                </span>
                <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-[#0b1c30]">
                  {editingCategory ? "Sửa danh mục" : "Thêm danh mục mới"}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleModalClose}
                className="p-1 text-slate-500 transition-colors hover:text-red-600"
                aria-label="ÄÃ³ng form"
              >
                <Icon name="close" className="text-2xl" />
              </button>
            </div>

            <form className="space-y-6 p-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0b1c30]">
                  Tên danh mục <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="VD: Món nước"
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0b1c30]">
                  Mô tả chi tiết
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
                  placeholder="Nhập mô tả cho danh mục này..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">
                    Ảnh danh mục
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => {
                      void handleImageFileChange(event);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="text-xs text-slate-500">
                    {isUploadingImage
                      ? "Đang tải ảnh..."
                      : "Chọn ảnh có sẵn trên máy."}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">
                      Thứ tự hiển thị
                    </label>
                    <input
                      type="number"
                      value={formState.displayOrder}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          displayOrder: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                    />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0b1c30]">
                  Loại danh mục <span className="text-red-600">*</span>
                </label>

                <select
                  value={formState.logicType}
                  onChange={(event) => {
                    const logicType = event.target.value as CategoryLogicType;

                    setFormState((current) => ({
                      ...current,
                      logicType,
                      requiresPreparation: logicType === "prepared",
                      isStockReturnable: logicType === "stock_returnable",
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                >
                  <option value="prepared">
                    Món cần chế biến / pha chế
                  </option>
                  <option value="stock_returnable">
                    Hàng có sẵn / đóng chai / hoàn kho được
                  </option>
                </select>

                <p className="text-xs text-slate-500">
                  Món cần chế biến sẽ không hoàn kho khi hủy hóa đơn. Hàng có sẵn như nước chai,
                  nước lon sẽ được hoàn lại tồn kho khi hủy hóa đơn.
                </p>
              </div>

              {formState.imageUrl.trim() ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <img
                    src={formState.imageUrl}
                    alt="Ảnh xem trước"
                    className="h-36 w-full object-cover"
                  />
                </div>
              ) : null}


              <div className="flex gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="flex h-10 flex-1 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex h-10 flex-1 items-center justify-center bg-[#f97316] px-4 text-sm font-bold text-white transition-colors hover:bg-[#ea580c]"
                >
                  {editingCategory ? "Lưu thay đổi" : "Lưu danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showToast ? (
        <div className="pointer-events-none fixed right-8 bottom-8 z-60">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
              <Icon name="check" className="text-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0b1c30]">
                Dữ liệu đã đồng bộ
              </p>
              <p className="text-[10px] text-slate-500">
                Danh mục đã được cập nhật
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default CategoryPage;
