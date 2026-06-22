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
import { FilterBar } from "../../components/common/FilterBar";

type CustomerFormState = {
  fullName: string;
  phone: string;
  address: string;
};

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

function CustomerStatCard({
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
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${tone}`}>
        <Icon name={icon} className="text-xl" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-tight text-slate-500">
        {label}
      </p>
      <h3 className="mt-1 text-xl font-bold text-[#2a1b14]">{value}</h3>
    </article>
  );
}

function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>(defaultFormState);

  const loadCustomers = useCallback(async (query = "") => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await getCustomers(query);
      setCustomers(response.data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không tải được danh sách khách hàng. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCustomers(search);
    }, 250);

    return () => clearTimeout(timer);
  }, [search, loadCustomers]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const stats = useMemo(() => {
    const totalSpent = customers.reduce(
      (sum, customer) => sum + customer.totalSpent,
      0
    );
    const newCustomers = customers.filter((customer) => {
      const createdAt = new Date(customer.createdAt);
      const now = new Date();
      return (
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getFullYear() === now.getFullYear()
      );
    }).length;

    return [
      {
        label: "Tổng khách",
        value: String(customers.length),
        icon: "group",
        tone: "bg-green-50 text-green-600",
      },
      {
        label: "Khách mới tháng này",
        value: String(newCustomers),
        icon: "person_add",
        tone: "bg-orange-50 text-[#9d4300]",
      },
      {
        label: "Doanh thu khách",
        value: formatCurrency(totalSpent),
        icon: "payments",
        tone: "bg-blue-50 text-blue-600",
      },
    ];
  }, [customers]);

  const topVipCustomers = useMemo(
    () =>
      [...customers]
        .filter((customer) => customer.totalSpent > 0)
        .sort((first, second) => second.totalSpent - first.totalSpent)
        .slice(0, 10),
    [customers]
  );

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
        setSuccessMessage("Đã lưu thay đổi. Hồ sơ khách hàng đã được cập nhật.");
      } else {
        await createCustomer(payload);
        setSuccessMessage("Đã thêm khách hàng mới vào danh sách.");
      }

      closeModal();
      await loadCustomers(search);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Chưa lưu được khách hàng. Vui lòng kiểm tra lại thông tin."
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
      if (selectedCustomer?.id === customer.id) {
        setSelectedCustomer(null);
      }
      await loadCustomers(search);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Chưa xóa được khách hàng. Vui lòng thử lại."
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
        error instanceof Error ? error.message : "Không tải được chi tiết khách hàng. Vui lòng thử lại."
      );
    }
  };

  // Removed handleSearchSubmit as it is now live-searched with debounce

  return (
    <AdminLayout
      title="Khách hàng"
      subtitle="Quản lý hồ sơ khách quen và lịch sử mua hàng."
    >
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <CustomerStatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterBar
            search={search}
            onSearchChange={(val) => setSearch(val)}
            searchPlaceholder="Tìm tên, số điện thoại hoặc địa chỉ..."
            className="w-full max-w-2xl"
          />

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center justify-center gap-2 bg-[#9d4300] px-4 text-sm font-bold text-white transition-colors hover:bg-[#803600]"
          >
            <Icon name="add" />
            Thêm khách hàng
          </button>
        </div>

        {errorMessage ? (
          <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="border-b border-green-100 bg-green-50 px-6 py-3 text-sm font-semibold text-green-700">
            {successMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="p-6 text-sm font-medium text-slate-500">
            Đang tải khách hàng...
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-230 text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Tên</th>
                <th className="px-6 py-3">SĐT</th>
                <th className="px-6 py-3 text-right">Tổng chi tiêu</th>
                <th className="px-6 py-3 text-center">Số hóa đơn</th>
                <th className="px-6 py-3">Lần mua cuối</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-[#2a1b14]">{customer.fullName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {customer.address || "Chưa có địa chỉ"}
                    </p>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    {customer.phone}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[#2a1b14]">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {customer.orderCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-600">
                    {formatDate(customer.lastOrderAt)}
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        void handleViewDetails(customer);
                      }}
                      className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                      title="Xem chi tiết"
                    >
                      <Icon name="visibility" className="text-xl" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(customer)}
                      className="rounded-lg p-2 text-[#9d4300] transition-colors hover:bg-orange-50"
                      title="Sửa khách hàng"
                    >
                      <Icon name="edit" className="text-xl" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(customer);
                      }}
                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                      title="Xóa khách hàng"
                    >
                      <Icon name="delete" className="text-xl" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && customers.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-400">
            Không có khách hàng phù hợp.
          </div>
        ) : null}
      </section>

      {topVipCustomers.length > 0 ? (
        <section className="mt-6 border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9d4300]">
                Khách VIP
              </p>
              <h3 className="mt-1 text-xl font-bold text-[#2a1b14]">
                Top 10 khách chi tiêu nhiều nhất
              </h3>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {topVipCustomers.map((customer, index) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  void handleViewDetails(customer);
                }}
                className="border border-slate-200 bg-slate-50 p-3 text-left hover:border-[#9d4300]"
              >
                <p className="text-xs font-bold text-[#9d4300]">#{index + 1}</p>
                <p className="mt-1 truncate font-bold text-[#2a1b14]">
                  {customer.fullName}
                </p>
                <p className="text-xs text-slate-500">{customer.phone}</p>
                <p className="mt-2 text-sm font-extrabold text-[#2a1b14]">
                  {formatCurrency(customer.totalSpent)}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.45)] p-4">
          <div className="w-full max-w-4xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-[#2a1b14]">
                  {selectedCustomer.fullName}
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  SĐT: {selectedCustomer.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">Tổng chi tiêu</p>
                  <p className="mt-1 text-lg font-bold text-[#2a1b14]">
                    {formatCurrency(selectedCustomer.totalSpent)}
                  </p>
                </div>
                <div className="bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">Tổng hóa đơn</p>
                  <p className="mt-1 text-lg font-bold text-[#2a1b14]">
                    {selectedCustomer.orderCount}
                  </p>
                </div>
                <div className="bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">Lần mua gần nhất</p>
                  <p className="mt-1 text-lg font-bold text-[#2a1b14]">
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
                        <td className="px-4 py-3 font-bold text-[#2a1b14]">
                          HD{order.id.slice(0, 6).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#2a1b14]">
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

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.45)] p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-orange-50 p-2 text-[#9d4300]">
                  <Icon name="person" />
                </span>
                <h3 className="text-xl font-bold text-[#2a1b14]">
                  {editingCustomer ? "Sửa khách hàng" : "Thêm khách hàng"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <Icon name="close" />
              </button>
            </div>

            <form className="space-y-5 p-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#2a1b14]">
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
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#2a1b14]">
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
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: 0901234567"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#2a1b14]">
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
                  className="w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: Quan 1, TP. Ho Chi Minh"
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
                  className="flex h-10 flex-1 items-center justify-center bg-[#9d4300] px-4 text-sm font-bold text-white transition-colors hover:bg-[#803600] disabled:opacity-60"
                >
                  {isSaving ? "Đang lưu..." : editingCustomer ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default CustomerPage;
