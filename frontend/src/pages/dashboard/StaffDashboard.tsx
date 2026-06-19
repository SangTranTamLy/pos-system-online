import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { getEmployeeRevenue } from "../../api/report.api";
import type { EmployeeRevenue } from "../../types/report";
import EmployeeRevenueTable from "../../components/dashboard/EmployeeRevenueTable";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function StaffDashboard() {
  const navigate = useNavigate();
  const [employeeRevenue, setEmployeeRevenue] = useState<EmployeeRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

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

  return (
    <AdminLayout>
      <section className="mb-8">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[#0b1c30]">
            Tổng quan cá nhân
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Xem hiệu suất bán hàng của bạn trong ngày hoặc theo khoảng thời gian tùy chọn.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-orange-50 p-3 text-[#f97316]">
              <Icon name="payments" className="scale-125" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-500">Doanh thu của tôi</p>
          <h3 className="mt-2 text-3xl font-bold text-[#0b1c30]">{formatCurrency(myData.total_revenue)}</h3>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-green-50 p-3 text-green-600">
              <Icon name="receipt_long" className="scale-125" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-500">Số hóa đơn đã lập</p>
          <h3 className="mt-2 text-3xl font-bold text-[#0b1c30]">{myData.total_orders} đơn</h3>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => navigate("/pos")}
          className="group flex flex-col items-center justify-center rounded-2xl border border-[#f97316] bg-orange-50 p-6 transition-all hover:-translate-y-1 hover:shadow-md hover:shadow-orange-100"
        >
          <Icon name="point_of_sale" className="mb-3 text-4xl text-[#f97316]" />
          <h4 className="font-bold text-[#f97316]">Mở bán hàng POS</h4>
        </button>
        <button
          onClick={() => navigate("/invoices")}
          className="group flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-blue-400 hover:shadow-md hover:shadow-blue-50"
        >
          <Icon name="receipt" className="mb-3 text-4xl text-blue-500" />
          <h4 className="font-bold text-[#0b1c30] group-hover:text-blue-600">Xem danh sách hóa đơn</h4>
        </button>
      </section>

      <section className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#0b1c30]">
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
                onChange={(e) => setDateFrom(e.target.value)}
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
                onChange={(e) => setDateTo(e.target.value)}
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
