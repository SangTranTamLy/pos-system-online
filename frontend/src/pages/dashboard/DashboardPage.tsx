import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import {
  getDashboardSummary,
  type DashboardRevenuePeriod,
  type DashboardSummary,
} from "../../api/dashboard.api";
import RevenueChart, { type RevenuePoint } from "../../components/charts/RevenueChart";
import { PieChart, Pie, Cell } from "recharts";
import TopProductsCard, { type TopProduct } from "../../components/charts/TopProductsCard";
import { getEmployeeRevenue } from "../../api/report.api";
import type { EmployeeRevenue } from "../../types/report";
import EmployeeRevenueTable from "../../components/dashboard/EmployeeRevenueTable";

type StatsCardData = { label: string; value: string; icon: string; };
type RecentOrder = { code: string; customer: string; type: string; total: string; status: string; typeClassName: string; statusClassName: string; };
type DashboardMaterialRow = { name: string; sku: string; category: string; importPrice: string; };

function StatCard({ card }: { card: StatsCardData }) {
  return (
    <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between relative z-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#9d4300]">
          <Icon name={card.icon} className="text-[24px]" filled />
        </div>
      </div>
      <p className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
      <h3 className="relative z-10 mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold tracking-tight text-[#2a1b14]">{card.value}</h3>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function getOrderStatusLabel(status: string) {
  const labels: Record<string, string> = { completed: "Hoàn tất", cancelled: "Đã hủy", refunded: "Hoàn tiền" };
  return labels[status] ?? status;
}

function getOrderStatusClassName(status: string) {
  const classNames: Record<string, string> = { completed: "bg-green-50 text-green-600", cancelled: "bg-red-50 text-red-600", refunded: "bg-slate-100 text-slate-500" };
  return classNames[status] ?? "bg-slate-100 text-slate-500";
}


function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState<DashboardRevenuePeriod>("month");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const [reportDate, setReportDate] = useState(todayStr);

  const [employeeRevenue, setEmployeeRevenue] = useState<EmployeeRevenue[]>([]);

  useEffect(() => {
    let isActive = true;

    async function loadDashboard(silent = false) {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const response = await getDashboardSummary(revenuePeriod, reportDate, reportDate);
        if (isActive) {
          setDashboard(response.data);
          setErrorMessage("");
        }
      } catch (error) {
        if (isActive) setErrorMessage(error instanceof Error ? error.message : "Không tải được dữ liệu dashboard");
      } finally {
        if (isActive) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadDashboard();
    const interval = window.setInterval(() => { void loadDashboard(true); }, 60_000);
    return () => { isActive = false; window.clearInterval(interval); };
  }, [revenuePeriod, reportDate]);

  useEffect(() => {
    let isActive = true;
    getEmployeeRevenue(reportDate || undefined, reportDate || undefined)
      .then((data) => { if (isActive) setEmployeeRevenue(data); })
      .catch((error) => {
        if (isActive) setErrorMessage(error instanceof Error ? error.message : "Không tải được dữ liệu nhân viên");
      });
    return () => { isActive = false; };
  }, [reportDate]);

  function handleManualRefresh() {
    setIsRefreshing(true);
    getDashboardSummary(revenuePeriod, reportDate, reportDate)
      .then((response) => { setDashboard(response.data); setErrorMessage(""); })
      .catch((error) => { setErrorMessage(error instanceof Error ? error.message : "Không tải được dữ liệu dashboard"); })
      .finally(() => setIsRefreshing(false));
  }

  const stats = dashboard?.stats;

  const realStatsCards: StatsCardData[] = [
    { label: "Tổng doanh thu", value: formatCurrency(stats?.todayRevenue ?? 0), icon: "payments" },
    { label: "Tổng hóa đơn", value: String(stats?.todayOrders ?? 0), icon: "receipt_long" },
    { label: "Tổng giá trị kho", value: formatCurrency(stats?.totalStockValue ?? 0), icon: "warehouse" },
    { label: "Danh mục đang bán", value: String(stats?.activeCategories ?? 0), icon: "category" },
    { label: "Tổng nguyên liệu", value: String(stats?.totalMaterials ?? 0), icon: "kitchen" },
    { label: "Tổng khách hàng", value: String(stats?.totalCustomers ?? 0), icon: "group" },
    { label: "Sản phẩm đang bán", value: String(stats?.activeProducts ?? 0), icon: "inventory_2" },
  ];

  const realRevenueTrend: RevenuePoint[] = dashboard?.revenueTrend ?? [];

  const realTopProducts: TopProduct[] = (dashboard?.topProducts ?? []).map((item) => ({
    name: item.name,
    imageUrl: item.imageUrl,
    sold: `Đã bán: ${item.soldQuantity}`,
    revenue: formatCurrency(item.revenue),
  }));

  const realRecentOrders: RecentOrder[] = (dashboard?.recentOrders ?? []).map((order) => ({
    code: `#HD-${order.id.slice(0, 8).toUpperCase()}`, customer: order.customerName, type: "POS", total: formatCurrency(order.finalAmount), status: getOrderStatusLabel(order.status), typeClassName: "bg-orange-50 text-[#9d4300]", statusClassName: getOrderStatusClassName(order.status),
  }));

  const recentMaterials: DashboardMaterialRow[] = (dashboard?.materials ?? []).map((item) => ({
    name: item.name, sku: item.sku, category: item.category, importPrice: formatCurrency(item.importPrice),
  }));

  const paymentMethods = dashboard?.paymentMethods ?? [];
  const totalOrdersCount = paymentMethods.reduce((sum, item) => sum + (item.ordersCount || 0), 0);

  const paymentMethodColors: Record<string, string> = {
    'cash': '#9d4300', // Orange 500
    'qr': '#fb923c',   // Orange 400
    'card': '#fed7aa', // Orange 200
  };
  const paymentMethodLabels: Record<string, string> = {
    'cash': 'Tiền mặt',
    'qr': 'QR',
    'card': 'Thẻ',
  };

  const standardMethods = ['cash', 'qr', 'card'];
  const donutData = standardMethods.map(m => {
    const found = paymentMethods.find(p => p.method.toLowerCase() === m);
    return {
      name: m,
      value: found ? found.revenue : 0,
      percentage: found ? found.percentage : 0,
      ordersCount: found ? found.ordersCount : 0
    };
  });

  if (isLoading && !dashboard) {
    return (
      <AdminLayout>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
          Đang tải dữ liệu dashboard...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      headerContent={
        <div className="flex items-center gap-2 ml-4">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-[#9d4300] outline-none transition-all focus:border-[#9d4300] focus:ring-2 focus:ring-orange-100"
          />
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-[#9d4300] hover:text-[#9d4300] disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <Icon name="refresh" className={`text-[18px] ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
    >
      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">{errorMessage}</div>
      ) : null}

      {/* Current shift indicator */}
      {dashboard?.currentShift && (
        <div className="mb-6 rounded-2xl bg-blue-50/50 p-4 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4 text-blue-900">
            <div className="bg-blue-100 text-blue-600 p-2.5 rounded-full">
              <Icon name="schedule" className="scale-110" />
            </div>
            <div>
              <p className="font-extrabold text-[15px]">
                Ca hiện tại: {new Date(dashboard.currentShift.expectedStartTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(dashboard.currentShift.expectedEndTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-sm mt-0.5 text-blue-700">Thu ngân: <span className="font-bold">{dashboard.currentShift.userName}</span></p>
            </div>
          </div>
          <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            Đang hoạt động
          </span>
        </div>
      )}



      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {realStatsCards.map((card) => (<StatCard key={card.label} card={card} />))}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <RevenueChart data={realRevenueTrend} period={revenuePeriod} onPeriodChange={setRevenuePeriod} />
        </div>

        <div className="flex flex-col gap-6 xl:col-span-4">
          <TopProductsCard products={realTopProducts} />
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 2xl:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm 2xl:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#2a1b14]">Hóa đơn gần đây</h4>
            <button type="button" className="text-xs font-bold text-[#9d4300] hover:underline">Xem tất cả</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="bg-slate-50 font-semibold text-slate-500">
                <tr><th className="px-6 py-3">Mã đơn</th><th className="px-6 py-3">Khách hàng</th><th className="px-6 py-3 text-right">Tổng tiền</th><th className="px-6 py-3 text-center">Trạng thái</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {realRecentOrders.length > 0 ? (
                  realRecentOrders.map((order) => (
                    <tr key={order.code} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-[#9d4300]">{order.code}</td>
                      <td className="px-6 py-4 text-[#2a1b14] truncate max-w-30">{order.customer}</td>
                      <td className="px-6 py-4 text-right font-semibold text-[#2a1b14]">{order.total}</td>
                      <td className="px-6 py-4 text-center"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${order.statusClassName}`}>{order.status}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-slate-400">Chưa có hóa đơn gần đây</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-lg shadow-slate-200/40 2xl:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#2a1b14]">Nguyên liệu mới thêm</h4>
            <button type="button" onClick={() => navigate("/stock/materials")} className="text-[11px] font-bold uppercase tracking-widest text-[#9d4300] hover:underline">Xem tất cả</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-104 text-left text-sm">
              <thead className="bg-slate-50/50 font-semibold text-slate-400">
                <tr>
                  <th className="px-6 py-4 uppercase tracking-widest text-[10px]">Nguyên liệu</th>
                  <th className="px-6 py-4 uppercase tracking-widest text-[10px]">Phân loại</th>
                  <th className="px-6 py-4 text-right uppercase tracking-widest text-[10px]">Giá nhập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMaterials.length > 0 ? (
                  recentMaterials.map((item) => (
                    <tr key={item.sku} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-[#2a1b14] font-semibold truncate max-w-30">
                        <div>
                          <p className="font-extrabold text-[#2a1b14]">{item.name}</p>
                          <p className="text-[11px] text-slate-400">SKU: {item.sku}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{item.category}</td>
                      <td className="px-6 py-4 text-right font-bold text-[#9d4300]">{item.importPrice}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-sm font-semibold text-slate-400">Không có nguyên liệu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl border border-slate-200/60 bg-white shadow-lg shadow-slate-200/40 2xl:col-span-3">
          <div className="p-6 pb-2">
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-black text-[14px] uppercase tracking-wider text-[#2a1b14]">Phương thức thanh toán</h4>
          </div>
          <div className="p-6 pt-2 flex-1 flex flex-col justify-center">
            {totalOrdersCount > 0 ? (
              <div className="flex items-center justify-between gap-6 px-2">
                <div className="relative h-37.5 w-37.5 shrink-0">
                  <PieChart width={150} height={150}>
                    <Pie
                      data={donutData.filter(d => d.value > 0)}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={4}
                    >
                      {donutData.filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={paymentMethodColors[entry.name]} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tổng</span>
                    <span className="text-[28px] font-black leading-none text-[#2a1b14]">{totalOrdersCount}</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-5">
                  {donutData.map(item => {
                    const isZero = item.ordersCount === 0;
                    return (
                      <div key={item.name} className={`flex items-center justify-between transition-opacity duration-200 ${isZero ? "opacity-40" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: paymentMethodColors[item.name] }} />
                          <span className="text-[13px] font-bold text-slate-700">{paymentMethodLabels[item.name]}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[15px] font-black text-[#2a1b14]">{item.percentage}%</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.ordersCount} đơn</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                <Icon name="pie_chart" className="text-[48px] opacity-20" />
                <p className="text-sm font-semibold">Chưa có giao dịch</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <EmployeeRevenueTable data={employeeRevenue} />
      </section>
    </AdminLayout>
  );
}

export default DashboardPage;
