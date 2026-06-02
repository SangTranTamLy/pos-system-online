import { useEffect, useMemo, useState } from "react";
import {
  getCategories,
  type Category as ApiCategory,
} from "../../api/category.api";

type NavItem = {
  label: string;
  icon: string;
  active?: boolean;
  system?: boolean;
};

type StatCardData = {
  label: string;
  value: string;
  icon: string;
  iconWrapperClassName: string;
  iconClassName: string;
};

type CategoryStatus = "active" | "hidden";

const navItems: NavItem[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Bán hàng tại quầy", icon: "point_of_sale" },
  { label: "Đơn pickup", icon: "local_shipping" },
  { label: "Sản phẩm", icon: "inventory_2" },
  { label: "Danh mục", icon: "category", active: true },
  { label: "Kho hàng", icon: "warehouse" },
  { label: "Khách hàng", icon: "group" },
  { label: "Hóa đơn", icon: "receipt_long" },
  { label: "Khuyến mãi", icon: "confirmation_number" },
  { label: "Tài khoản", icon: "account_circle", system: true },
  { label: "Phân quyền", icon: "admin_panel_settings", system: true },
  { label: "Báo cáo", icon: "bar_chart", system: true },
  { label: "Cấu hình hệ thống", icon: "settings", system: true },
];

const statCards: StatCardData[] = [
  {
    label: "Tổng danh mục",
    value: "12",
    icon: "folder_zip",
    iconWrapperClassName: "bg-[#e5eeff]",
    iconClassName: "text-[#f97316]",
  },
  {
    label: "Đang hoạt động",
    value: "10",
    icon: "check_circle",
    iconWrapperClassName: "bg-green-50",
    iconClassName: "text-green-600",
  },
  {
    label: "Đã ẩn",
    value: "02",
    icon: "visibility_off",
    iconWrapperClassName: "bg-gray-100",
    iconClassName: "text-[#565e74]",
  },
];

function Icon({
  name,
  filled = false,
  className = "",
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined inline-flex shrink-0 align-middle ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}

function NavButton({ item }: { item: NavItem }) {
  return (
    <button
      type="button"
      className={[
        "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors",
        item.active
          ? "bg-[#dae2fd] font-bold text-[#5c647a]"
          : "text-[#565e74] hover:bg-[#dce9ff]",
      ].join(" ")}
    >
      <Icon name={item.icon} />
      <span className="text-sm font-semibold tracking-[0.02em]">{item.label}</span>
    </button>
  );
}

function StatCard({ item }: { item: StatCardData }) {
  return (
    <article className="rounded-lg border border-[#e0c0b1] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[#565e74]">{item.label}</p>
          <h3 className="mt-1 text-3xl font-bold text-[#0b1c30]">{item.value}</h3>
        </div>
        <div className={`rounded-lg p-3 ${item.iconWrapperClassName}`}>
          <Icon name={item.icon} className={item.iconClassName} />
        </div>
      </div>
    </article>
  );
}

function CategoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CategoryStatus>("all");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(true);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    displayOrder: "1",
    isActive: true,
  });

  const pageSize = 3;
  const mainNavItems = navItems.filter((item) => !item.system);
  const systemNavItems = navItems.filter((item) => item.system);

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

    useEffect(() => {
      async function loadCategories() {
        try {
          setIsLoading(true);
          setErrorMessage("");

          const response = await getCategories();
          setCategories(response.data);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Không tải được danh mục");
        } finally {
          setIsLoading(false);
        }
      }

      loadCategories();
    }, []);
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

  const paginatedCategories = filteredCategories.slice((page - 1) * pageSize, page * pageSize);

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsModalOpen(false);
    setShowToast(true);
    setFormState({
      name: "",
      description: "",
      displayOrder: "1",
      isActive: true,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9ff] font-['Inter',sans-serif] text-[#0b1c30]">
      <aside className="hidden h-full w-64 shrink-0 overflow-y-auto border-r border-[#e0c0b1] bg-[#f8f9ff] px-4 py-6 lg:flex lg:flex-col">
        <div className="mb-8 px-4">
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold text-[#9d4300]">
            Kinetic Retail
          </h1>
          <p className="text-xs text-[#584237] opacity-70">POS Terminal 01</p>
        </div>

        <nav className="flex-1 space-y-1">
          {mainNavItems.map((item) => (
            <NavButton key={item.label} item={item} />
          ))}

          <div className="mt-4 border-t border-[#e0c0b1] pb-2 pt-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-widest text-[#8c7164]">
              Hệ thống
            </p>
          </div>

          {systemNavItems.map((item) => (
            <NavButton key={item.label} item={item} />
          ))}
        </nav>
      </aside>

      <main className="flex h-full flex-1 flex-col overflow-y-auto bg-[#f8f9ff]">
        <header className="flex shrink-0 flex-col gap-4 border-b border-[#e0c0b1] bg-white px-6 py-4 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-[#e0c0b1] p-2 text-[#565e74] lg:hidden"
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <div className="flex flex-col">
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-[#0b1c30]">
                Quản lý danh mục
              </h2>
              <p className="text-xs text-[#584237]">
                Tạo và quản lý nhóm sản phẩm/dịch vụ trong hệ thống POS.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-3 border-[#e0c0b1] lg:border-r lg:pr-6">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#0b1c30]">Admin Demo</p>
                <p className="text-[10px] font-medium text-[#584237]">Administrator</p>
              </div>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWwEbShZNRfAC24nYYWaFqNDNQoCACzmqVa1fUPuuzYUJIBhYw7tdC1GwYXE823W58XknL3xVeQe1xIl8fiz74SWWSG8fsuY4iTPpKqRVzuLuvlzqMI0AHeCWzYyzDnfKREJcAy34j60Og4B1HacQ1VgZlv7a5bnJRHsZCyrH0rLsWjarO3cxPTSwzt6qwCVAXUAsnZ88NqADVy2madMSg8jMwDXBg-qit0cE5AKP7aPfeI9z7PfG2-ZSfJ4eZdKue0E3PCbf9b8K_"
                alt="Admin Profile"
                className="h-10 w-10 rounded-full border-2 border-[#ffdbca] object-cover"
              />
            </div>

            <button
              type="button"
              className="flex items-center gap-2 text-[#ba1a1a] transition-opacity hover:opacity-80"
            >
              <Icon name="logout" />
              <span className="text-sm font-semibold tracking-[0.02em]">Đăng xuất</span>
            </button>
          </div>
        </header>

        <div className="border-b border-[#e0c0b1] bg-white px-4 py-3 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {mainNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={[
                  "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  item.active
                    ? "border-[#dae2fd] bg-[#dae2fd] text-[#5c647a]"
                    : "border-[#e0c0b1] bg-white text-[#565e74] hover:bg-[#dce9ff]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8 p-4 sm:p-6 lg:p-8">
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {statCards.map((item) => (
              <StatCard key={item.label} item={item} />
            ))}
          </section>

          <section className="overflow-hidden rounded-lg border border-[#e0c0b1] bg-white shadow-sm">
            <div className="flex flex-col items-stretch justify-between gap-4 border-b border-[#e0c0b1] bg-white p-4 md:flex-row md:items-center">
              <div className="flex w-full flex-1 flex-col gap-4 md:flex-row md:items-center">
                <div className="relative w-full max-w-md">
                  <Icon
                    name="search"
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-[#584237]"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm kiếm danh mục..."
                    className="w-full rounded-lg border-2 border-[#e0c0b1] bg-white py-2 pr-4 pl-10 text-sm transition-all outline-none focus:border-[#f97316]"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | CategoryStatus)}
                  className="min-w-[180px] rounded-lg border-2 border-[#e0c0b1] bg-white py-2 pr-10 pl-4 text-sm outline-none transition-all focus:border-[#f97316]"
                >
                  <option value="all">Trạng thái: Tất cả</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="hidden">Đã ẩn</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#f97316] px-6 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
              >
                <Icon name="add" />
                Thêm danh mục
              </button>
            </div>
            {isLoading && (
              <div className="p-6 text-sm font-medium text-[#584237]">
                Đang tải danh mục...
              </div>
            )}
            {errorMessage && (
              <div className="p-6 text-sm font-semibold text-red-600">
                {errorMessage}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-920px text-left">
                <thead className="border-b border-[#e0c0b1] bg-[#eff4ff]">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-[#19191a]">
                      Tên danh mục
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-[#0b1c30]">
                      Mô tả
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-wider text-[#0b1c30]">
                      Số SP
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-[#0b1c30]">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-[#0b1c30]">
                      Ngày tạo
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider text-[#0b1c30]">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0c0b1]">
                  {paginatedCategories.map((category) => {
                    const isHidden = !category.isActive;

                    return (
                      <tr
                        key={category.id}
                        className="group transition-colors hover:bg-[#e5eeff]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-[#9d4300]">
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
                            "max-w- 200px px-6 py-4 text-sm text-[#565e74]",
                            isHidden ? "italic opacity-60" : "truncate",
                          ].join(" ")}
                        >
                          {category.description}
                        </td>
                        <td
                          className={[
                            "px-6 py-4 text-center text-sm font-medium text-[#0b1c30]",
                            isHidden ? "opacity-60" : "",
                          ].join(" ")}
                        >
                          {0}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide",
                              isHidden
                                ? "bg-gray-200 text-gray-600"
                                : "bg-green-100 text-green-700",
                            ].join(" ")}
                          >
                            {isHidden ? "Đã ẩn" : "Đang hoạt động"}
                          </span>
                        </td>
                        <td
                          className={[
                            "px-6 py-4 text-sm text-[#584237]",
                            isHidden ? "opacity-60" : "",
                          ].join(" ")}
                        >
                          {new Date(category.createdAt).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="space-x-2 px-6 py-4 text-right">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-[#9d4300] transition-colors hover:bg-orange-50"
                          >
                            <Icon name="edit" className="text-xl" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-[#565e74] transition-colors hover:bg-gray-100"
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

            <div className="flex flex-col items-start justify-between gap-4 border-t border-[#e0c0b1] bg-white p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-[#584237]">
                Hiển thị <span className="font-bold text-[#0b1c30]">{paginatedCategories.length}</span> trên{" "}
                <span className="font-bold text-[#0b1c30]">{filteredCategories.length}</span> danh mục
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-[#e0c0b1] p-2 transition-colors hover:bg-[#e5eeff] disabled:opacity-30"
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
                        : "text-[#0b1c30] hover:bg-[#e5eeff]",
                    ].join(" ")}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-[#e0c0b1] p-2 transition-colors hover:bg-[#e5eeff] disabled:opacity-30"
                >
                  <Icon name="chevron_right" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.4)] p-4 backdrop-blur-[4px]">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#e0c0b1] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e0c0b1] bg-[#e5eeff] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-[#ffdbca] p-2 text-[#9d4300]">
                  <Icon name="category" />
                </span>
                <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-[#0b1c30]">
                  Thêm danh mục mới
                </h3>
              </div>

              <button
                type="button"
                onClick={handleModalClose}
                className="p-1 text-[#565e74] transition-colors hover:text-[#ba1a1a]"
              >
                <Icon name="close" className="text-2xl" />
              </button>
            </div>

            <form className="space-y-6 p-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0b1c30]">
                  Tên danh mục <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="VD: Trà trái cây"
                  className="w-full rounded-lg border-2 border-[#e0c0b1] px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316]"
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
                  className="w-full resize-none rounded-lg border-2 border-[#e0c0b1] px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">Biểu tượng</label>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border-2 border-[#e0c0b1] px-4 py-2 text-left text-sm transition-colors hover:bg-[#e5eeff]"
                  >
                    <Icon name="local_cafe" className="text-[#9d4300]" />
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
                    className="w-full rounded-lg border-2 border-[#e0c0b1] px-4 py-2 text-sm outline-none transition-all focus:border-[#f97316]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#e5eeff] p-4">
                <div>
                  <p className="text-sm font-bold text-[#0b1c30]">Trạng thái hoạt động</p>
                  <p className="text-xs text-[#584237]">
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
                    formState.isActive ? "bg-[#f97316]" : "bg-gray-200",
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

              <div className="flex gap-3 border-t border-[#e0c0b1] pt-4">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="flex-1 rounded-lg border-2 border-[#565e74] px-6 py-3 font-bold text-[#565e74] transition-colors hover:bg-gray-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
                >
                  Lưu danh mục
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showToast ? (
        <div className="pointer-events-none fixed right-8 bottom-8 z-[60]">
          <div className="flex items-center gap-4 rounded-xl border border-[#e0c0b1] bg-white/80 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
              <Icon name="check" className="text-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0b1c30]">Dữ liệu đã sẵn sàng</p>
              <p className="text-[10px] text-[#565e74]">Hệ thống đồng bộ lúc 14:00</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CategoryPage;
