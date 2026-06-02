import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import {
  createCategory,
  getCategories,
  updateCategory,
  updateCategoryStatus,
  type Category as ApiCategory,
} from "../../api/category.api";

type CategoryStatus = "active" | "hidden";

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
  {
    label: "Đã ẩn",
    value: "0",
    icon: "visibility_off",
    iconBg: "bg-slate-100",
    iconText: "text-slate-500",
  },
];

const defaultFormState = {
  name: "",
  description: "",
  displayOrder: "1",
  isActive: true,
};

function CategoryStatCard({ card }: { card: CategoryStatCard }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className={`rounded-lg p-2 ${card.iconBg} ${card.iconText}`}>
          <Icon name={card.icon} className="scale-90" />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-tight text-slate-500">{card.label}</p>
      <h3 className="mt-1 text-xl font-bold text-[#0b1c30]">{card.value}</h3>
    </article>
  );
}

function CategoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CategoryStatus>("all");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [formState, setFormState] = useState(defaultFormState);

  const loadCategories = useCallback(async () => {
    try {
      setErrorMessage("");

      const response = await getCategories();
      setCategories(response.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không tải được danh mục");
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
    const activeCount = categories.filter((category) => category.isActive).length;
    const hiddenCount = categories.length - activeCount;

    return [
      { ...baseStatCards[0], value: String(categories.length) },
      { ...baseStatCards[1], value: String(activeCount) },
      { ...baseStatCards[2], value: String(hiddenCount) },
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
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && category.isActive) ||
        (statusFilter === "hidden" && !category.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const paginatedCategories = filteredCategories.slice((page - 1) * pageSize, page * pageSize);

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
      displayOrder: "1",
      isActive: category.isActive,
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

      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || null,
      };

      const response = editingCategory
        ? await updateCategory(editingCategory.id, payload)
        : await createCategory(payload);

      if (response.data.isActive !== formState.isActive) {
        await updateCategoryStatus(response.data.id, {
          isActive: formState.isActive,
        });
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

  const handleToggleStatus = async (category: ApiCategory) => {
    try {
      setErrorMessage("");
      await updateCategoryStatus(category.id, {
        isActive: !category.isActive,
      });
      await loadCategories();
      setShowToast(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Cập nhật trạng thái danh mục thất bại"
      );
    }
  };

  return (
    <AdminLayout
      title="Quản lý danh mục"
      subtitle="Tạo và quản lý nhóm sản phẩm/dịch vụ trong hệ thống POS."
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

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | CategoryStatus);
                setPage(1);
              }}
              className="min-w-[180px] rounded-lg border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
            >
              <option value="all">Trạng thái: Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="hidden">Đã ẩn</option>
            </select>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#f97316] px-6 py-2.5 font-bold text-white shadow-md transition-all hover:brightness-110 active:translate-y-px"
          >
            <Icon name="add" />
            Thêm danh mục
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm font-medium text-slate-500">Đang tải danh mục...</div>
        ) : null}
        {errorMessage ? (
          <div className="p-6 text-sm font-semibold text-red-600">{errorMessage}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Tên danh mục</th>
                <th className="px-6 py-3">Mô tả</th>
                <th className="px-6 py-3 text-center">Số SP</th>
                <th className="px-6 py-3 text-center">Trạng thái</th>
                <th className="px-6 py-3">Ngày tạo</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedCategories.map((category) => {
                const isHidden = !category.isActive;

                return (
                  <tr key={category.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#f97316]">
                          <Icon name="category" />
                        </div>
                        <span
                          className={[
                            "font-bold text-[#0b1c30]",
                            isHidden ? "opacity-60" : "",
                          ].join(" ")}
                        >
                          {category.name}
                        </span>
                      </div>
                    </td>
                    <td
                      className={[
                        "max-w-[240px] px-6 py-4 text-slate-600",
                        isHidden ? "italic opacity-60" : "truncate",
                      ].join(" ")}
                    >
                      {category.description || "Chưa có mô tả"}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-[#0b1c30]">0</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          isHidden
                            ? "bg-slate-100 text-slate-500"
                            : "bg-green-50 text-green-600",
                        ].join(" ")}
                      >
                        {isHidden ? "Đã ẩn" : "Đang hoạt động"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(category.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="space-x-2 px-6 py-4 text-right">
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
                          void handleToggleStatus(category);
                        }}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label={isHidden ? "Kích hoạt danh mục" : "Ẩn danh mục"}
                      >
                        <Icon
                          name={isHidden ? "visibility_off" : "visibility"}
                          className="text-xl"
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Hiển thị{" "}
            <span className="font-bold text-[#0b1c30]">{paginatedCategories.length}</span>{" "}
            trên <span className="font-bold text-[#0b1c30]">{filteredCategories.length}</span>{" "}
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
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.4)] p-4 backdrop-blur-[4px]">
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
                aria-label="Đóng form"
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
                  placeholder="VD: Trà trái cây"
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0b1c30]">Mô tả chi tiết</label>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Nhập mô tả cho danh mục này..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">Biểu tượng</label>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                  >
                    <Icon name="local_cafe" className="text-[#f97316]" />
                    Chọn icon
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">Thứ tự hiển thị</label>
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

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-[#0b1c30]">Trạng thái hoạt động</p>
                  <p className="text-xs text-slate-500">
                    Cho phép danh mục xuất hiện trên màn hình bán hàng.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      isActive: !current.isActive,
                    }))
                  }
                  className={[
                    "relative h-6 w-12 rounded-full transition-colors",
                    formState.isActive ? "bg-[#f97316]" : "bg-slate-300",
                  ].join(" ")}
                  aria-pressed={formState.isActive}
                >
                  <span
                    className={[
                      "absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform",
                      formState.isActive ? "translate-x-6" : "translate-x-[2px]",
                    ].join(" ")}
                  />
                </button>
              </div>

              <div className="flex gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="flex-1 rounded-lg border border-slate-300 px-6 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white shadow-lg transition-all hover:brightness-110 active:translate-y-px"
                >
                  {editingCategory ? "Lưu thay đổi" : "Lưu danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showToast ? (
        <div className="pointer-events-none fixed right-8 bottom-8 z-[60]">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
              <Icon name="check" className="text-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0b1c30]">Dữ liệu đã đồng bộ</p>
              <p className="text-[10px] text-slate-500">Danh mục đã được cập nhật từ MySQL</p>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default CategoryPage;
