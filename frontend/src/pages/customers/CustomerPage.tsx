import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  deleteCustomer,
  getCustomerOrders,
  getCustomerPoints,
  getCustomers,
  updateCustomer,
  type Customer,
  type CustomerOrderSummary,
  type CustomerPointTransaction,
} from "../../api/customers.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type CustomerFormState = {
  fullName: string;
  phone: string;
  email: string;
};

const defaultFormState: CustomerFormState = {
  fullName: "",
  phone: "",
  email: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Chua co";
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
      <h3 className="mt-1 text-xl font-bold text-[#0b1c30]">{value}</h3>
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
  const [customerPoints, setCustomerPoints] = useState<CustomerPointTransaction[]>([]);
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
        error instanceof Error ? error.message : "Khong tai duoc danh sach khach hang"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers("");
  }, [loadCustomers]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const stats = useMemo(() => {
    const totalPoints = customers.reduce(
      (sum, customer) => sum + customer.loyaltyPoints,
      0
    );
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
        label: "Tong khach",
        value: String(customers.length),
        icon: "group",
        tone: "bg-green-50 text-green-600",
      },
      {
        label: "Khach moi thang nay",
        value: String(newCustomers),
        icon: "person_add",
        tone: "bg-orange-50 text-[#f97316]",
      },
      {
        label: "Diem dang co",
        value: String(totalPoints),
        icon: "stars",
        tone: "bg-amber-50 text-amber-600",
      },
      {
        label: "Doanh thu khach",
        value: formatCurrency(totalSpent),
        icon: "payments",
        tone: "bg-blue-50 text-blue-600",
      },
    ];
  }, [customers]);

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
      email: customer.email ?? "",
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
        phone: formState.phone.trim(),
        email: formState.email.trim() || null,
      };

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        setSuccessMessage("Da cap nhat khach hang");
      } else {
        await createCustomer(payload);
        setSuccessMessage("Da them khach hang");
      }

      closeModal();
      await loadCustomers(search);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Luu khach hang that bai"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(
      `Ban co chac muon xoa khach hang "${customer.fullName}" khong?`
    );

    if (!confirmed) return;

    try {
      setErrorMessage("");
      await deleteCustomer(customer.id);
      setSuccessMessage("Da xoa khach hang");
      if (selectedCustomer?.id === customer.id) {
        setSelectedCustomer(null);
      }
      await loadCustomers(search);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Xoa khach hang that bai"
      );
    }
  };

  const handleViewDetails = async (customer: Customer) => {
    try {
      setSelectedCustomer(customer);
      setErrorMessage("");
      const [pointsResponse, ordersResponse] = await Promise.all([
        getCustomerPoints(customer.id),
        getCustomerOrders(customer.id),
      ]);
      setCustomerPoints(pointsResponse.data);
      setCustomerOrders(ordersResponse.data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Khong tai duoc chi tiet khach hang"
      );
    }
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadCustomers(search);
  };

  return (
    <AdminLayout
      title="Khach hang"
      subtitle="Quan ly ho so, diem tich luy va lich su mua hang."
    >
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <CustomerStatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <form
            className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
            onSubmit={handleSearchSubmit}
          >
            <div className="relative flex-1">
              <Icon
                name="search"
                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tim ten, so dien thoai hoac email..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Icon name="search" className="text-lg" />
              Tim
            </button>
          </form>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#f97316] px-6 py-2.5 font-bold text-white shadow-md transition-all hover:brightness-110 active:translate-y-px"
          >
            <Icon name="add" />
            Them khach hang
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
            Dang tai khach hang...
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Khach hang</th>
                <th className="px-6 py-3">Lien he</th>
                <th className="px-6 py-3 text-right">Diem</th>
                <th className="px-6 py-3 text-right">Tong chi</th>
                <th className="px-6 py-3 text-center">Hoa don</th>
                <th className="px-6 py-3 text-right">Thao tac</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-[#0b1c30]">{customer.fullName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Tao ngay {formatDate(customer.createdAt)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-700">{customer.phone}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {customer.email || "Chua co email"}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[#0b1c30]">
                    {customer.loyaltyPoints}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[#0b1c30]">
                    {formatCurrency(customer.totalSpent)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {customer.orderCount}
                    </span>
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        void handleViewDetails(customer);
                      }}
                      className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                      title="Xem chi tiet"
                    >
                      <Icon name="visibility" className="text-xl" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(customer)}
                      className="rounded-lg p-2 text-[#f97316] transition-colors hover:bg-orange-50"
                      title="Sua khach hang"
                    >
                      <Icon name="edit" className="text-xl" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(customer);
                      }}
                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                      title="Xoa khach hang"
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
            Khong co khach hang phu hop.
          </div>
        ) : null}
      </section>

      {selectedCustomer ? (
        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#f97316]">
                  Chi tiet khach hang
                </p>
                <h3 className="mt-1 text-xl font-bold text-[#0b1c30]">
                  {selectedCustomer.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">So dien thoai</p>
                <p className="mt-1 font-bold text-[#0b1c30]">{selectedCustomer.phone}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Email</p>
                <p className="mt-1 font-bold text-[#0b1c30]">
                  {selectedCustomer.email || "Chua co"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Lan mua gan nhat</p>
                <p className="mt-1 font-bold text-[#0b1c30]">
                  {formatDate(selectedCustomer.lastOrderAt)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Tong chi tieu</p>
                <p className="mt-1 font-bold text-[#0b1c30]">
                  {formatCurrency(selectedCustomer.totalSpent)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#f97316]">
              Lich su diem va mua hang
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 font-bold text-[#0b1c30]">Diem tich luy</h4>
                <div className="space-y-2">
                  {customerPoints.slice(0, 5).map((point) => (
                    <div key={point.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold text-slate-700">
                          {point.transactionType}
                        </span>
                        <span className="font-bold text-[#0b1c30]">{point.points}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(point.createdAt)}</p>
                    </div>
                  ))}
                  {customerPoints.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                      Chua co lich su diem.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-bold text-[#0b1c30]">Hoa don gan day</h4>
                <div className="space-y-2">
                  {customerOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold text-slate-700">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span className="font-bold text-[#0b1c30]">
                          {formatCurrency(order.finalAmount)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(order.createdAt)}</p>
                    </div>
                  ))}
                  {customerOrders.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                      Chua co hoa don.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.45)] p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-orange-50 p-2 text-[#f97316]">
                  <Icon name="person" />
                </span>
                <h3 className="text-xl font-bold text-[#0b1c30]">
                  {editingCustomer ? "Sua khach hang" : "Them khach hang"}
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
                <label className="block text-sm font-semibold text-[#0b1c30]">
                  Ten khach hang <span className="text-red-600">*</span>
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
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: Nguyen Van A"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0b1c30]">
                  So dien thoai <span className="text-red-600">*</span>
                </label>
                <input
                  required
                  value={formState.phone}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: 0901234567"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0b1c30]">
                  Email
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  placeholder="VD: khach@example.com"
                />
              </div>

              <div className="flex gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-300 px-6 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Huy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-60"
                >
                  {isSaving ? "Dang luu..." : editingCustomer ? "Luu thay doi" : "Them moi"}
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
