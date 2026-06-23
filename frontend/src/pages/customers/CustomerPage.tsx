import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  deleteCustomer,
  getCustomerOrders,
  getCustomers,
  updateCustomer,
  type Customer,
  type CustomerOrderSummary,
} from "../../api/customers.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type CustomerFormState = {
  fullName: string;
  phone: string;
  address: string;
};

type CustomerSegment = "all" | "loyal" | "regular" | "new";
type CustomerStatus = "all" | "active" | "inactive";

const defaultFormState: CustomerFormState = {
  fullName: "",
  phone: "",
  address: "",
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.slice(-2).map((part) => part[0]).join("") || "KH").toUpperCase();
}

function getCustomerCode(customer: Customer) {
  return `KH${customer.id.slice(0, 4).toUpperCase()}`;
}

function getSegment(customer: Customer): Exclude<CustomerSegment, "all"> {
  if (customer.totalSpent >= 5_000_000 || customer.orderCount >= 10) return "loyal";
  if (customer.orderCount > 0 || customer.totalSpent > 0) return "regular";
  return "new";
}

function getSegmentMeta(segment: Exclude<CustomerSegment, "all">) {
  if (segment === "loyal") {
    return {
      label: "Thân thiết",
      className: "bg-orange-50 text-[#f97316] border border-orange-200",
      dot: "bg-[#f97316]",
      color: "#f97316",
    };
  }

  if (segment === "regular") {
    return {
      label: "Thường",
      className: "bg-slate-100 text-slate-700 border border-slate-200",
      dot: "bg-slate-500",
      color: "#64748b",
    };
  }

  return {
    label: "Mới",
    className: "bg-slate-50 text-slate-500 border border-slate-200",
    dot: "bg-slate-400",
    color: "#94a3b8",
  };
}

/* ─── Avatar colors by initial letter ─────────────────────────── */
function getAvatarColor() {
  // Synchronized with standard profile avatar in header (bg-slate-100 and primary orange text)
  return "bg-slate-100 text-[#f97316] border border-slate-200";
}

/* ─── Stat Card ───────────────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  note,
  iconBg,
  iconColor,
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <article className="group border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center ${iconBg}`}
        >
          <Icon name={icon} filled className={`text-3xl ${iconColor}`} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-[22px] font-extrabold tracking-tight text-[#0b1c30]">
            {value}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>
        </div>
      </div>
    </article>
  );
}

/* ─── Donut segment (SVG) ─────────────────────────────────────── */
function DonutChart({
  segments,
  total,
}: {
  segments: Array<{ color: string; percent: number }>;
  total: number;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="22"
        />
        {segments.map((seg, i) => {
          const dashLength = (seg.percent / 100) * circumference;
          const gap = circumference - dashLength;
          const offset = accumulatedOffset;
          accumulatedOffset += dashLength;
          return (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="22"
              strokeDasharray={`${dashLength} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              className="transition-all duration-700"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-[#0b1c30]">
          {total.toLocaleString("vi-VN")}
        </span>
        <span className="text-xs font-semibold text-slate-400">Tổng</span>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment>("all");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>(defaultFormState);

  /* pagination */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadCustomers = useCallback(async (query = "") => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await getCustomers(query);
      setCustomers(response.data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không tải được danh sách khách hàng. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers(search);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadCustomers, search]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  /* ── Stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const totalSpent = customers.reduce(
      (sum, customer) => sum + Number(customer.totalSpent || 0),
      0
    );
    const newThisMonth = customers.filter((customer) => {
      const createdAt = new Date(customer.createdAt);
      const now = new Date();
      return (
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getFullYear() === now.getFullYear()
      );
    }).length;
    const loyalCount = customers.filter((customer) => getSegment(customer) === "loyal")
      .length;

    return {
      totalSpent,
      newThisMonth,
      loyalCount,
    };
  }, [customers]);

  /* ── Filtered + paginated ──────────────────────────────────── */
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const segment = getSegment(customer);
      const isActive = customer.orderCount > 0 || customer.totalSpent > 0;
      const matchesSegment = segmentFilter === "all" || segment === segmentFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);
      return matchesSegment && matchesStatus;
    });
  }, [customers, segmentFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedCustomers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, safePage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [segmentFilter, statusFilter, search, pageSize]);

  /* ── Segment stats for donut ───────────────────────────────── */
  const segmentStats = useMemo(() => {
    const total = Math.max(customers.length, 1);
    const otherCount = customers.filter(
      (c) => !["loyal", "regular", "new"].includes(getSegment(c))
    ).length;

    const segments = (["loyal", "regular", "new"] as const).map((segment) => {
      const count = customers.filter((customer) => getSegment(customer) === segment).length;
      return {
        ...getSegmentMeta(segment),
        count,
        percent: Math.round((count / total) * 1000) / 10,
      };
    });

    return {
      segments,
      other: {
        count: otherCount,
        percent: Math.round((otherCount / total) * 1000) / 10,
      },
    };
  }, [customers]);

  const topCustomers = useMemo(
    () =>
      [...customers]
        .filter((customer) => customer.totalSpent > 0)
        .sort((first, second) => second.totalSpent - first.totalSpent)
        .slice(0, 5),
    [customers]
  );

  /* ── Actions ──────────────────────────────────────────────── */
  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormState(defaultFormState);
    setErrorMessage("");
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormState({
      fullName: customer.fullName,
      phone: customer.phone,
      address: customer.address ?? "",
    });
    setErrorMessage("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormState(defaultFormState);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setErrorMessage("");

      const payload = {
        fullName: formState.fullName.trim(),
        phone: formState.phone.replace(/\D/g, ""),
        address: formState.address.trim() || null,
      };

      if (!/^[0-9]{10}$/.test(payload.phone)) {
        setErrorMessage("Số điện thoại phải gồm đúng 10 chữ số.");
        return;
      }

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        setSuccessMessage("Đã lưu thay đổi khách hàng.");
      } else {
        await createCustomer(payload);
        setSuccessMessage("Đã thêm khách hàng mới.");
      }

      closeModal();
      await loadCustomers(search);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Chưa lưu được khách hàng. Vui lòng kiểm tra lại thông tin."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa khách hàng "${customer.fullName}" không?`
    );

    if (!confirmed) return;

    try {
      setErrorMessage("");
      await deleteCustomer(customer.id);
      setSuccessMessage("Đã xóa khách hàng khỏi danh sách.");
      if (selectedCustomer?.id === customer.id) setSelectedCustomer(null);
      await loadCustomers(search);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Chưa xóa được khách hàng. Vui lòng thử lại."
      );
    }
  };

  const handleViewDetails = async (customer: Customer) => {
    try {
      setSelectedCustomer(customer);
      setErrorMessage("");
      const ordersResponse = await getCustomerOrders(customer.id);
      setCustomerOrders(ordersResponse.data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không tải được chi tiết khách hàng. Vui lòng thử lại."
      );
    }
  };

  /* ── Pagination helpers ────────────────────────────────────── */
  function renderPageButtons() {
    const buttons: React.ReactNode[] = [];
    const maxVisible = 5;

    let startPage = Math.max(1, safePage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          type="button"
          onClick={() => setCurrentPage(1)}
          className="flex h-9 w-9 items-center justify-center text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis-start" className="flex h-9 w-9 items-center justify-center text-slate-400">
            …
          </span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          type="button"
          onClick={() => setCurrentPage(i)}
          className={[
            "flex h-9 w-9 items-center justify-center text-sm font-bold transition-colors",
            i === safePage
              ? "bg-[#f97316] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100",
          ].join(" ")}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="ellipsis-end" className="flex h-9 w-9 items-center justify-center text-slate-400">
            …
          </span>
        );
      }
      buttons.push(
        <button
          key={totalPages}
          type="button"
          onClick={() => setCurrentPage(totalPages)}
          className="flex h-9 w-9 items-center justify-center text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <AdminLayout>
      <div className="space-y-6 font-['Inter',sans-serif]">
        {/* ─ Page Title ─ */}
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-[#0b1c30]">
          Khách hàng
        </h1>

        {/* ─ Stat Cards ─ */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon="groups"
            label="Tổng khách hàng"
            value={customers.length.toLocaleString("vi-VN")}
            note={`↑ Theo dữ liệu hiện tại`}
            iconBg="bg-orange-50"
            iconColor="text-[#f97316]"
          />
          <StatCard
            icon="person_add"
            label="Khách hàng mới (tháng này)"
            value={String(stats.newThisMonth)}
            note={`↑ Trong tháng này`}
            iconBg="bg-orange-50"
            iconColor="text-[#f97316]"
          />
          <StatCard
            icon="loyalty"
            label="Khách hàng thân thiết"
            value={String(stats.loyalCount)}
            note={`${customers.length ? Math.round((stats.loyalCount / customers.length) * 1000) / 10 : 0}% tổng khách hàng`}
            iconBg="bg-orange-50"
            iconColor="text-[#f97316]"
          />
          <StatCard
            icon="payments"
            label="Doanh thu từ KH"
            value={formatCurrency(stats.totalSpent)}
            note={`↑ Tổng chi tiêu đã ghi nhận`}
            iconBg="bg-orange-50"
            iconColor="text-[#f97316]"
          />
        </section>

        {/* ─ Alerts ─ */}
        {errorMessage ? (
          <div className="border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-600">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {/* ─ Main grid: table + sidebar ─ */}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Customer list table ────────────────────────────── */}
          <div className="border border-slate-200 bg-white p-5 shadow-sm">
            {/* toolbar */}
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold text-[#0b1c30]">
                Danh sách khách hàng
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {/* search */}
                <div className="relative">
                  <Icon
                    name="search"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo tên, SĐT, email..."
                    className="h-10 w-56 border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-[#0b1c30] outline-none transition-colors focus:border-[#f97316]"
                  />
                </div>

                {/* segment filter */}
                <select
                  value={segmentFilter}
                  onChange={(event) => setSegmentFilter(event.target.value as CustomerSegment)}
                  className="h-10 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-[#f97316]"
                >
                  <option value="all">Nhóm khách hàng</option>
                  <option value="loyal">Thân thiết</option>
                  <option value="regular">Thường</option>
                  <option value="new">Mới</option>
                </select>

                {/* status filter */}
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as CustomerStatus)}
                  className="h-10 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-[#f97316]"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Không hoạt động</option>
                </select>

                {/* export button */}
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-[#f97316] hover:text-[#f97316]"
                >
                  <Icon name="download" className="text-[18px]" />
                  Xuất Excel
                </button>

                {/* add button */}
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-10 items-center gap-2 bg-[#f97316] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#ea6c0e]"
                >
                  <Icon name="add" className="text-[18px]" />
                  Thêm khách hàng
                </button>
              </div>
            </div>

            {/* table */}
            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Mã KH</th>
                    <th className="px-4 py-4">Họ tên</th>
                    <th className="px-4 py-4">SĐT</th>
                    <th className="px-4 py-4">Nhóm KH</th>
                    <th className="px-4 py-4">Lần mua cuối</th>
                    <th className="px-4 py-4 text-right">Tổng mua hàng</th>
                    <th className="px-4 py-4">Trạng thái</th>
                    <th className="px-4 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCustomers.map((customer) => {
                    const segment = getSegment(customer);
                    const meta = getSegmentMeta(segment);
                    const isActive = customer.orderCount > 0 || customer.totalSpent > 0;

                    return (
                      <tr key={customer.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-4 font-bold text-[#0b1c30]">
                          {getCustomerCode(customer)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarColor()}`}
                            >
                              {getInitials(customer.fullName)}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleViewDetails(customer)}
                              className="font-bold text-[#0b1c30] transition-colors hover:text-[#f97316]"
                            >
                              {customer.fullName}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-600">
                          {customer.phone}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-bold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-600">
                          {formatDate(customer.lastOrderAt)}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-[#0b1c30]">
                          {formatCurrency(customer.totalSpent)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={[
                              "inline-flex items-center px-2.5 py-1 text-xs font-bold border",
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-50 text-slate-600 border-slate-200",
                            ].join(" ")}
                          >
                            {isActive ? "Hoạt động" : "Không hoạt động"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(customer)}
                              className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-[#f97316] transition-colors hover:bg-orange-50"
                              title="Sửa khách hàng"
                            >
                              <Icon name="edit" className="text-[18px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(customer)}
                              className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-rose-600 transition-colors hover:bg-rose-50"
                              title="Xóa khách hàng"
                            >
                              <Icon name="delete" className="text-[18px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!isLoading && paginatedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm font-bold text-slate-400">
                        Không có khách hàng phù hợp.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm font-medium text-slate-500">
                Hiển thị {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredCustomers.length)} của{" "}
                <span className="font-bold text-[#0b1c30]">
                  {filteredCustomers.length.toLocaleString("vi-VN")}
                </span>{" "}
                khách hàng
              </p>

              <div className="flex items-center gap-2">
                {/* prev */}
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
                >
                  <Icon name="chevron_left" className="text-[18px]" />
                </button>

                {renderPageButtons()}

                {/* next */}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
                >
                  <Icon name="chevron_right" className="text-[18px]" />
                </button>

                {/* page size */}
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="ml-2 h-9 border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-600 outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} / trang
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Sidebar ──────────────────────────────────────── */}
          <aside className="space-y-5">
            {/* Nhóm khách hàng (donut) */}
            <section className="border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold text-[#0b1c30]">
                Nhóm khách hàng
              </h2>

              <div className="mt-5">
                <DonutChart
                  total={customers.length}
                  segments={[
                    ...segmentStats.segments.map((s) => ({
                      color: s.color,
                      percent: s.percent,
                    })),
                    {
                      color: "#94a3b8",
                      percent: segmentStats.other.percent,
                    },
                  ]}
                />
              </div>

              <div className="mt-5 space-y-3">
                {segmentStats.segments.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${seg.dot}`} />
                      <span className="font-semibold text-slate-600">{seg.label}</span>
                    </div>
                    <span className="font-bold text-[#0b1c30]">
                      {seg.count} ({seg.percent}%)
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="font-semibold text-slate-600">Khác</span>
                  </div>
                  <span className="font-bold text-[#0b1c30]">
                    {segmentStats.other.count} ({segmentStats.other.percent}%)
                  </span>
                </div>
              </div>
            </section>

            {/* Top khách hàng (doanh số) */}
            <section className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold text-[#0b1c30]">
                  Top khách hàng (doanh số)
                </h2>
                <select className="h-9 border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">
                  <option>Tháng này</option>
                </select>
              </div>

              <div className="space-y-4">
                {topCustomers.map((customer, index) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => void handleViewDetails(customer)}
                    className="flex w-full items-center justify-between gap-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 text-center text-sm font-bold text-slate-400">
                        {index + 1}
                      </span>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarColor()}`}
                      >
                        {getInitials(customer.fullName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[#0b1c30]">
                          {customer.fullName}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {customer.phone}
                        </span>
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-[#0b1c30]">
                      {formatCurrency(customer.totalSpent)}
                    </span>
                  </button>
                ))}
                {topCustomers.length === 0 ? (
                  <p className="py-6 text-center text-sm font-semibold text-slate-400">
                    Chưa có khách hàng phát sinh doanh số.
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </section>

        {/* ─── Detail modal ─────────────────────────────────── */}
        {selectedCustomer ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.45)] p-4">
            <div className="w-full max-w-4xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                    {selectedCustomer.fullName}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    SĐT: {selectedCustomer.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 text-slate-500 transition-colors hover:bg-slate-50"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto p-6">
                <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Tổng chi tiêu</p>
                    <p className="mt-1 text-lg font-extrabold text-[#0b1c30]">
                      {formatCurrency(selectedCustomer.totalSpent)}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Tổng hóa đơn</p>
                    <p className="mt-1 text-lg font-extrabold text-[#0b1c30]">
                      {selectedCustomer.orderCount}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">Lần mua gần nhất</p>
                    <p className="mt-1 text-lg font-extrabold text-[#0b1c30]">
                      {formatDate(selectedCustomer.lastOrderAt)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200">
                  <table className="w-full min-w-140 text-left text-sm">
                    <thead className="bg-slate-50 font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Mã hóa đơn</th>
                        <th className="px-4 py-3">Ngày</th>
                        <th className="px-4 py-3 text-right">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {customerOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3 font-bold text-[#0b1c30]">
                            HD{order.id.slice(0, 6).toUpperCase()}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#0b1c30]">
                            {formatCurrency(order.finalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {customerOrders.length === 0 ? (
                    <p className="bg-slate-50 p-4 text-sm text-slate-500">
                      Chưa có hóa đơn.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── Create / Edit modal ──────────────────────────── */}
        {isModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.45)] p-4">
            <div className="w-full max-w-lg overflow-hidden border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="bg-orange-50 p-2 text-[#f97316]">
                    <Icon name="person" />
                  </span>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                    {editingCustomer ? "Sửa khách hàng" : "Thêm khách hàng"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 text-slate-500 transition-colors hover:bg-slate-100"
                >
                  <Icon name="close" />
                </button>
              </div>

              <form className="space-y-5 p-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">
                    Tên khách hàng <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    value={formState.fullName}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    className="w-full border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">
                    Số điện thoại <span className="text-red-600">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={formState.phone}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    className="w-full border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                    placeholder="VD: 0901234567"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0b1c30]">
                    Địa chỉ
                  </label>
                  <textarea
                    rows={3}
                    value={formState.address}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    className="w-full resize-none border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                    placeholder="VD: Quận 1, TP. Hồ Chí Minh"
                  />
                </div>

                <div className="flex gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-10 flex-1 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex h-10 flex-1 items-center justify-center bg-[#f97316] px-4 text-sm font-bold text-white transition-colors hover:bg-[#ea6c0e] disabled:opacity-60"
                  >
                    {isSaving ? "Đang lưu..." : editingCustomer ? "Lưu thay đổi" : "Thêm mới"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}

export default CustomerPage;
