import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrders, type OrderListItem } from "../../api/order.api";
import { getEmployeeRevenue } from "../../api/report.api";
import { fetchShifts, type Shift } from "../../api/shifts.api";
import EmployeeRevenueTable from "../../components/dashboard/EmployeeRevenueTable";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import type { EmployeeRevenue } from "../../types/report";

type AuthUser = {
  id?: string;
  fullName?: string;
  roleName?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatShiftTime(value?: string | null) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatShiftDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
}

function getShiftName(shift: Shift) {
  const startHour = new Date(shift.expectedStartTime).getHours();

  if (startHour >= 6 && startHour < 12) return "Ca sáng";
  if (startHour >= 12 && startHour < 18) return "Ca chiều";
  return "Ca tối";
}

function getStoredAuthUser(): AuthUser {
  const storedUser = localStorage.getItem("auth_user");

  if (!storedUser) return {};

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return {};
  }
}

function ShiftStatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: string;
  tone: string;
  label: string;
  value: string | number;
}) {
  return (
    <article className="rounded-2xl bg-slate-50 p-4">
      <div className={`mb-2 flex items-center gap-2 ${tone}`}>
        <Icon name={icon} className="text-[20px]" />
        <p className="text-xs font-extrabold uppercase text-slate-400">{label}</p>
      </div>
      <p className="text-2xl font-black text-[#0b1c30]">{value}</p>
    </article>
  );
}

function StaffDashboard() {
  const navigate = useNavigate();
  const [employeeRevenue, setEmployeeRevenue] = useState<EmployeeRevenue[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftOrders, setShiftOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [shiftErrorMessage, setShiftErrorMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadShift = useCallback(async () => {
    const user = getStoredAuthUser();

    try {
      setIsShiftLoading(true);
      setShiftErrorMessage("");

      const shifts = await fetchShifts();
      const openShift =
        shifts.find((shift) => shift.status === "OPEN" && shift.userId === user.id) || null;

      setActiveShift(openShift);

      if (!openShift) {
        setShiftOrders([]);
        return;
      }

      const orders = await getOrders({
        shiftId: openShift.id,
      });

      setShiftOrders(orders.data);
    } catch (error) {
      setActiveShift(null);
      setShiftOrders([]);
      setShiftErrorMessage(
        error instanceof Error ? error.message : "Không tải được dữ liệu ca làm."
      );
    } finally {
      setIsShiftLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShift();
  }, [loadShift]);

  useEffect(() => {
    let isActive = true;
    Promise.resolve().then(() => {
      if (isActive) setIsLoading(true);
    });

    getEmployeeRevenue(dateFrom || undefined, dateTo || undefined)
      .then((data) => {
        if (isActive) {
          setEmployeeRevenue(data);
          setErrorMessage("");
        }
      })
      .catch((err) => {
        if (isActive) {
          setErrorMessage(
            err instanceof Error ? err.message : "Không tải được dữ liệu cá nhân"
          );
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [dateFrom, dateTo]);

  const myData = employeeRevenue[0] || { total_orders: 0, total_revenue: 0 };
  const shiftTimeRange = activeShift
    ? `${formatShiftTime(activeShift.expectedStartTime)} - ${formatShiftTime(activeShift.expectedEndTime)}`
    : "";
  const completedShiftOrders = shiftOrders.filter((order) => order.status === "completed");
  const shiftRevenue = completedShiftOrders.reduce(
    (sum, order) => sum + Number(order.finalAmount || 0),
    0
  );
  const shiftCashRevenue = completedShiftOrders
    .filter((order) => order.paymentMethod === "cash")
    .reduce((sum, order) => sum + Number(order.finalAmount || 0), 0);
  const cashInDrawer = activeShift
    ? Number(activeShift.openingCash || 0) + shiftCashRevenue
    : 0;
  const variance = Number(activeShift?.variance || 0);

  return (
    <AdminLayout
      title="Ca làm"
      subtitle="Theo dõi ca đang bán, doanh thu và đối soát trong ca làm."
      headerContent={
        <>
          <button
            type="button"
            onClick={() => {
              void loadShift();
            }}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]"
          >
            <Icon name="sync" className="text-[18px]" />
            Tải lại
          </button>
          <button
            type="button"
            onClick={() => navigate("/pos")}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#0b1c30] px-4 text-sm font-extrabold text-white transition hover:bg-[#132a45]"
          >
            <Icon name="shopping_cart" className="text-[18px]" />
            Bán hàng
          </button>
        </>
      }
    >
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {isShiftLoading ? (
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
            <Icon name="sync" className="animate-spin text-[20px]" />
            Đang tải ca làm...
          </div>
        ) : activeShift ? (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Đang bán hàng
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                    {getShiftName(activeShift)} ({shiftTimeRange})
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">
                  Nhận ca:{" "}
                  <span className="text-slate-700">
                    {formatShiftDateTime(activeShift.actualStartTime || activeShift.updatedAt)}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ShiftStatCard
                icon="monitoring"
                tone="text-emerald-600"
                label="Doanh thu ca"
                value={formatCurrency(shiftRevenue)}
              />
              <ShiftStatCard
                icon="receipt_long"
                tone="text-blue-600"
                label="Số đơn"
                value={completedShiftOrders.length}
              />
              <ShiftStatCard
                icon="payments"
                tone="text-[#f97316]"
                label="Tiền mặt cần có"
                value={formatCurrency(cashInDrawer)}
              />
              <ShiftStatCard
                icon="difference"
                tone="text-purple-600"
                label="Lệch tiền"
                value={activeShift.actualEndTime ? (variance === 0 ? "0 đ" : formatCurrency(variance)) : "Chưa chốt"}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">
                <Icon name="schedule" className="text-[16px]" />
                Chưa có ca đang mở
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Vui lòng liên hệ quản lý để mở ca trước khi bán hàng.
              </p>
              {shiftErrorMessage ? (
                <p className="mt-2 text-sm font-semibold text-red-600">{shiftErrorMessage}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                void loadShift();
              }}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-700 hover:bg-white"
            >
              <Icon name="sync" className="text-[18px]" />
              Tải lại ca
            </button>
          </div>
        )}
      </section>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 rounded-lg bg-orange-50 p-3 text-[#f97316] w-fit">
            <Icon name="payments" className="scale-125" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Doanh thu của tôi</p>
          <h3 className="mt-2 text-3xl font-bold text-[#0b1c30]">
            {formatCurrency(myData.total_revenue)}
          </h3>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 rounded-lg bg-green-50 p-3 text-green-600 w-fit">
            <Icon name="receipt_long" className="scale-125" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Số hóa đơn đã lập</p>
          <h3 className="mt-2 text-3xl font-bold text-[#0b1c30]">{myData.total_orders} đơn</h3>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate("/pos")}
          className="group flex flex-col items-center justify-center rounded-2xl border border-[#f97316] bg-orange-50 p-6 transition-all hover:-translate-y-1 hover:shadow-md hover:shadow-orange-100"
        >
          <Icon name="point_of_sale" className="mb-3 text-4xl text-[#f97316]" />
          <h4 className="font-bold text-[#f97316]">Mở bán hàng POS</h4>
        </button>
        <button
          type="button"
          onClick={() => navigate("/invoices")}
          className="group flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-blue-400 hover:shadow-md hover:shadow-blue-50"
        >
          <Icon name="receipt" className="mb-3 text-4xl text-blue-500" />
          <h4 className="font-bold text-[#0b1c30] group-hover:text-blue-600">
            Xem danh sách hóa đơn
          </h4>
        </button>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-['Outfit',sans-serif] text-lg font-bold text-[#0b1c30]">
            Chi tiết thống kê
          </h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="pointer-events-none absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Từ ngày
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-[#0b1c30] outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Đến ngày
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-[#0b1c30] outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Đang tải...</p>
        ) : (
          <EmployeeRevenueTable data={employeeRevenue} />
        )}
      </section>
    </AdminLayout>
  );
}

export default StaffDashboard;
