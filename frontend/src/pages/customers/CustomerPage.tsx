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
import { useAppNotifications } from "../../components/common/AppNotificationsContext";
import Pagination from "../../components/common/Pagination";

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
          const offset = segments
            .slice(0, i)
            .reduce((sum, item) => sum + (item.percent / 100) * circumference, 0);
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
  const { notify, confirm: confirmAction } = useAppNotifications();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment>("all");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>(defaultFormState);

  /* pagination */
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const loadCustomers = useCallback(async (query = "") => {
    try {
      setIsLoading(true);

      const response = await getCustomers(query);
      setCustomers(response.data);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Không tải được danh sách khách hàng. Vui lòng thử lại.",
        "error"
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
    void Promise.resolve().then(() => setCurrentPage(1));
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
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormState({
      fullName: customer.fullName,
      phone: customer.phone,
      address: customer.address ?? "",
    });

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


      const payload = {
        fullName: formState.fullName.trim(),
        phone: formState.phone.replace(/\D/g, ""),
        address: formState.address.trim() || null,
      };

      if (!/^[0-9]{10}$/.test(payload.phone)) {
        notify("Số điện thoại phải gồm đúng 10 chữ số.", "error");
        return;
      }

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        notify("Đã lưu thay đổi khách hàng.", "success");
      } else {
        await createCustomer(payload);
        notify("Đã thêm khách hàng mới.", "success");
      }

      closeModal();
      await loadCustomers(search);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Chưa lưu được khách hàng. Vui lòng kiểm tra lại thông tin.",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = await confirmAction({
      title: "Xóa khách hàng",
      message: `Bạn có chắc chắn muốn xóa khách hàng "${customer.fullName}" không?`,
      confirmText: "Xóa",
      type: "warning",
    });

    if (!confirmed) return;

    try {

      await deleteCustomer(customer.id);
      notify("Đã xóa khách hàng khỏi danh sách.", "success");
      if (selectedCustomer?.id === customer.id) setSelectedCustomer(null);
      await loadCustomers(search);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Chưa xóa được khách hàng. Vui lòng thử lại.",
        "error"
      );
    }
  };

  const handleViewDetails = async (customer: Customer) => {
    try {
      setSelectedCustomer(customer);

      const ordersResponse = await getCustomerOrders(customer.id);
      setCustomerOrders(ordersResponse.data);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Không tải được chi tiết khách hàng. Vui lòng thử lại.",
        "error"
      );
    }
  };

  /* ── Pagination helpers ────────────────────────────────────── */


  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <AdminLayout
      title="Quản lý khách hàng"
      subtitle="Lưu trữ thông tin, lịch sử mua hàng và chương trình thành viên."
    >
      <div className="space-y-6 font-['Inter',sans-serif]">




        {/* ─ Main grid: table + sidebar ─ */}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Customer list table ────────────────────────────── */}
          <div className="border border-slate-200 bg-white p-5 shadow-sm">
            {/* toolbar */}
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="font-['Outfit',sans-serif] text-lg font-extrabold text-[#0b1c30]">
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
              <table className="w-full min-w-245 text-left text-sm">
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
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredCustomers.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemName="khách hàng"
            />
          </div>

          {/* ── Sidebar ──────────────────────────────────────── */}
          <aside className="space-y-5">
            {/* Nhóm khách hàng (donut) */}
            <section className="border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-['Outfit',sans-serif] text-lg font-extrabold text-[#0b1c30]">
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
                <h2 className="font-['Outfit',sans-serif] text-lg font-extrabold text-[#0b1c30]">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b p-5">
                <div>
                  <p className="text-xs font-black uppercase text-[#f97316]">
                    SĐT: {selectedCustomer.phone}
                  </p>
                  <h3 className="text-xl font-black text-[#0b1c30]">
                    {selectedCustomer.fullName}
                  </h3>
                </div>
                <button type="button" onClick={() => setSelectedCustomer(null)}>
                  <Icon name="close" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b p-5">
                <div>
                  <p className="text-xs font-black uppercase text-[#f97316]">
                    {editingCustomer ? "Cập nhật khách hàng" : "Khách hàng mới"}
                  </p>
                  <h3 className="text-xl font-black text-[#0b1c30]">
                    {formState.fullName || "Tên khách hàng"}
                  </h3>
                </div>
                <button type="button" onClick={closeModal}>
                  <Icon name="close" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <form id="customerForm" className="space-y-5" onSubmit={handleSubmit}>
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

                </form>
              </div>
              <div className="flex justify-end gap-3 border-t p-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border px-5 py-2 font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="customerForm"
                  disabled={isSaving}
                  className="rounded-lg bg-[#f97316] px-5 py-2 font-bold text-white disabled:opacity-50"
                >
                  {isSaving ? "Đang lưu..." : editingCustomer ? "Lưu thay đổi" : "Thêm khách hàng"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}

export default CustomerPage;
