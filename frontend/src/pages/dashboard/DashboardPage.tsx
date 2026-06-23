import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDashboardSummary,
  type DashboardRevenuePeriod,
  type DashboardSummary,
} from "../../api/dashboard.api";
import { getEmployeeRevenue } from "../../api/report.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import type { EmployeeRevenue } from "../../types/report";

type KpiCard = {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone: "blue" | "green" | "amber" | "rose";
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  qr: "QR",
  card: "Thẻ",
};

const paymentMethodColors: Record<string, string> = {
  cash: "#1f5a9d",
  qr: "#0ea5e9",
  card: "#8b5cf6",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("vi-VN", {
      maximumFractionDigits: 1,
    })}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("vi-VN")}K`;
  }

  return value.toLocaleString("vi-VN");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getTodayInputValue() {
  return new Date().toISOString().split("T")[0];
}

function getOrderStatus(status: string) {
  const labels: Record<string, string> = {
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    refunded: "Hoàn tiền",
  };

  const classes: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
    refunded: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return {
    label: labels[status] ?? status,
    className: classes[status] ?? "bg-slate-50 text-slate-600 border-slate-200",
  };
}

function KpiCard({ card }: { card: KpiCard }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  const borderTones = {
    blue: "border-slate-200",
    green: "border-slate-200",
    amber: "border-slate-200",
    rose: "border-rose-200",
  };

  return (
    <article className={`border ${borderTones[card.tone]} bg-white p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
            {card.label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-[#0b1c30]">
            {card.value}
          </p>
          <p
            className={`mt-3 text-xs font-bold ${
              card.tone === "rose" ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {card.helper}
          </p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center ${tones[card.tone]}`}>
          <Icon name={card.icon} className="text-xl" />
        </div>
      </div>
    </article>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-black uppercase tracking-wide text-[#0b1c30]">
        {title}
      </h3>
      {action}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
      {children}
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [employeeRevenue, setEmployeeRevenue] = useState<EmployeeRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [revenuePeriod, setRevenuePeriod] =
    useState<DashboardRevenuePeriod>("month");
  const [reportDate, setReportDate] = useState(getTodayInputValue);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadDashboard(silent = false) {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [dashboardResponse, employeeResponse] = await Promise.all([
          getDashboardSummary(revenuePeriod, reportDate, reportDate),
          getEmployeeRevenue(reportDate, reportDate),
        ]);

        if (isActive) {
          setDashboard(dashboardResponse.data);
          setEmployeeRevenue(employeeResponse);
          setErrorMessage("");
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Không tải được dữ liệu dashboard."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadDashboard();
    const interval = window.setInterval(() => {
      void loadDashboard(true);
    }, 60_000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [revenuePeriod, reportDate]);

  async function handleManualRefresh() {
    setIsRefreshing(true);
    try {
      const [dashboardResponse, employeeResponse] = await Promise.all([
        getDashboardSummary(revenuePeriod, reportDate, reportDate),
        getEmployeeRevenue(reportDate, reportDate),
      ]);
      setDashboard(dashboardResponse.data);
      setEmployeeRevenue(employeeResponse);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không tải được dữ liệu dashboard."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const stats = dashboard?.stats;
  const lowStockItems = dashboard?.lowStockItems ?? [];
  const paymentMethods = dashboard?.paymentMethods ?? [];
  const categorySales = dashboard?.categorySales ?? [];
  const topProducts = dashboard?.topProducts ?? [];
  const recentOrders = dashboard?.recentOrders ?? [];
  const recentMaterials = dashboard?.materials ?? [];
  const totalPaymentOrders = paymentMethods.reduce(
    (sum, item) => sum + item.ordersCount,
    0
  );
  const totalCategoryRevenue = categorySales.reduce(
    (sum, item) => sum + item.revenue,
    0
  );

  const kpiCards: KpiCard[] = [
    {
      label: "Doanh thu hôm nay",
      value: formatCurrency(stats?.todayRevenue ?? 0),
      helper: "Tổng doanh thu trong ngày đã chọn",
      icon: "trending_up",
      tone: "green",
    },
    {
      label: "Đơn hàng",
      value: `${stats?.todayOrders ?? 0} đơn`,
      helper: "Hóa đơn hoàn thành trong ngày",
      icon: "shopping_cart",
      tone: "blue",
    },
    {
      label: "Sản phẩm đang bán",
      value: `${stats?.activeProducts ?? 0} món`,
      helper: `${stats?.activeCategories ?? 0} danh mục đang hoạt động`,
      icon: "inventory_2",
      tone: "amber",
    },
    {
      label: "Cảnh báo tồn kho thấp",
      value: `${lowStockItems.length} mặt hàng`,
      helper:
        lowStockItems.length > 0
          ? "Cần kiểm tra và nhập bổ sung"
          : "Tồn kho đang an toàn",
      icon: "error",
      tone: lowStockItems.length > 0 ? "rose" : "green",
    },
  ];

  const paymentChartData = paymentMethods
    .filter((item) => item.revenue > 0 || item.ordersCount > 0)
    .map((item) => ({
      ...item,
      label: paymentMethodLabels[item.method] ?? item.method,
      color: paymentMethodColors[item.method] ?? "#64748b",
    }));

  const topEmployees = useMemo(
    () =>
      [...employeeRevenue]
        .sort((left, right) => right.total_revenue - left.total_revenue)
        .slice(0, 4),
    [employeeRevenue]
  );

  if (isLoading && !dashboard) {
    return (
      <AdminLayout title="Dashboard Tổng Quan" subtitle="Đang tải dữ liệu vận hành...">
        <div className="border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
          Đang tải dữ liệu dashboard...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Dashboard Tổng Quan"
      subtitle="Hệ thống POS tích hợp quản lý kho và cảnh báo tồn kho thấp"
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex h-10 items-center gap-2 border border-slate-200 bg-white px-3 text-sm font-bold text-[#0b1c30]">
            <Icon name="calendar_month" className="text-base text-slate-400" />
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              className="min-w-0 bg-transparent outline-none"
            />
          </label>
          <div className="flex h-10 items-center gap-2 bg-[#0b1c30] px-4 text-sm font-black text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {now.toLocaleTimeString("vi-VN", { hour12: false })}
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-50"
          >
            <Icon
              name="refresh"
              className={`text-base ${isRefreshing ? "animate-spin" : ""}`}
            />
            Làm mới
          </button>
        </div>
        {dashboard?.currentShift ? (
          <div className="border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-black">Ca hiện tại:</span>{" "}
            {formatTime(dashboard.currentShift.expectedStartTime)} -{" "}
            {formatTime(dashboard.currentShift.expectedEndTime)} ·{" "}
            <span className="font-bold">{dashboard.currentShift.userName}</span>
          </div>
        ) : (
          <div className="border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">
            Chưa có ca làm đang mở
          </div>
        )}
      </div>

      {errorMessage ? (
        <div className="mb-6 border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_1.2fr_0.95fr]">
        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title={revenuePeriod === "month" ? "Doanh thu trong tháng" : "Doanh thu trong năm"}
            action={
              <select
                value={revenuePeriod}
                onChange={(event) =>
                  setRevenuePeriod(event.target.value as DashboardRevenuePeriod)
                }
                className="h-9 border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none"
                aria-label="Chọn kỳ xem doanh thu"
              >
                <option value="month">Theo tháng</option>
                <option value="year">Theo năm</option>
              </select>
            }
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dashboard?.revenueTrend ?? []}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2f89d9" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#2f89d9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  interval={revenuePeriod === "month" ? 3 : 0}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                />
                <YAxis hide domain={[0, "dataMax"]} />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Doanh thu"]}
                  contentStyle={{
                    border: "1px solid #dbeafe",
                    borderRadius: 8,
                    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2f89d9"
                  strokeWidth={3}
                  fill="url(#revenueFill)"
                  dot={{ r: 3, fill: "#2f89d9", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Bán hàng theo danh mục" />
          {categorySales.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categorySales} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "revenue"
                        ? formatCurrency(Number(value))
                        : `${Number(value).toLocaleString("vi-VN")} món`,
                      name === "revenue" ? "Doanh thu" : "Số lượng",
                    ]}
                    contentStyle={{
                      border: "1px solid #dbeafe",
                      borderRadius: 8,
                      boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]} maxBarSize={42}>
                    {categorySales.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={index === 0 ? "#1f5a9d" : "#dbeafe"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState>Chưa có dữ liệu bán hàng theo danh mục</EmptyState>
          )}
          {totalCategoryRevenue > 0 ? (
            <p className="mt-4 text-xs font-bold text-slate-500">
              Tổng doanh thu theo danh mục:{" "}
              <span className="text-[#0b1c30]">{formatCurrency(totalCategoryRevenue)}</span>
            </p>
          ) : null}
        </div>

        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Phương thức thanh toán" />
          {paymentChartData.length > 0 ? (
            <div className="grid min-h-72 items-center gap-4 sm:grid-cols-[150px_1fr] xl:grid-cols-1 2xl:grid-cols-[150px_1fr]">
              <div className="relative mx-auto h-[152px] w-[152px]">
                <PieChart width={152} height={152}>
                  <Pie
                    data={paymentChartData}
                    dataKey="revenue"
                    innerRadius={50}
                    outerRadius={74}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {paymentChartData.map((item) => (
                      <Cell key={item.method} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Tổng
                  </span>
                  <span className="text-2xl font-black text-[#0b1c30]">
                    {totalPaymentOrders}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {paymentChartData.map((item) => (
                  <div key={item.method} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-bold text-slate-700">
                        {item.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#0b1c30]">
                        {item.percentage}%
                      </p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {item.ordersCount} đơn
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState>Chưa có giao dịch thanh toán</EmptyState>
          )}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_1.15fr_0.9fr]">
        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Giao dịch gần đây"
            action={
              <button
                type="button"
                onClick={() => navigate("/invoices")}
                className="bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
              >
                Xem tất cả
              </button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-black uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Mã hóa đơn</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="py-3 pl-4 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length > 0 ? (
                  recentOrders.map((order) => {
                    const status = getOrderStatus(order.status);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="py-4 pr-4 font-black text-[#0b1c30]">
                          HD{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-600">
                          {order.customerName}
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-[#0b1c30]">
                          {formatCurrency(order.finalAmount)}
                        </td>
                        <td className="py-4 pl-4 text-right">
                          <span
                            className={`inline-flex border px-3 py-1 text-xs font-black ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm font-bold text-slate-400">
                      Chưa có giao dịch trong ngày đã chọn
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Sản phẩm sắp hết hàng"
            action={
              <button
                type="button"
                onClick={() => navigate("/stock/materials")}
                className="bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
              >
                Xem kho
              </button>
            }
          />
          {lowStockItems.length > 0 ? (
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between gap-4 border border-rose-100 bg-rose-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#0b1c30]">{item.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {item.type === "product" ? "Sản phẩm" : "Nguyên liệu"}
                      {item.sku ? ` · ${item.sku}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-black text-rose-600">
                      {item.stockQuantity.toLocaleString("vi-VN")}
                      {item.unit ? ` ${item.unit}` : ""}
                    </p>
                    <p className="text-[11px] font-bold text-rose-400">
                      Ngưỡng {item.threshold}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>Tồn kho an toàn</EmptyState>
          )}
        </div>

        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Top bán chạy" />
          {topProducts.length > 0 ? (
            <div className="space-y-4">
              {topProducts.slice(0, 5).map((product, index) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-black text-slate-400">
                    {index + 1}
                  </span>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-200 bg-slate-50">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <Icon name="restaurant" className="text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#0b1c30]">
                      {product.name}
                    </p>
                    <p className="text-xs font-bold text-slate-400">
                      Đã bán: {product.soldQuantity}
                    </p>
                  </div>
                  <p className="text-right text-xs font-black text-emerald-600">
                    {formatCurrency(product.revenue)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>Chưa có sản phẩm bán ra</EmptyState>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Nguyên liệu mới thêm" />
          {recentMaterials.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs font-black uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-3 pr-4">Nguyên liệu</th>
                    <th className="px-4 py-3">Danh mục</th>
                    <th className="py-3 pl-4 text-right">Giá nhập</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentMaterials.map((item) => (
                    <tr key={item.sku}>
                      <td className="py-4 pr-4">
                        <p className="font-black text-[#0b1c30]">{item.name}</p>
                        <p className="text-xs font-bold text-slate-400">SKU: {item.sku}</p>
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-600">
                        {item.category}
                      </td>
                      <td className="py-4 pl-4 text-right font-black text-[#0b1c30]">
                        {formatCurrency(item.importPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Chưa có nguyên liệu</EmptyState>
          )}
        </div>

        <div className="border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader title="Hiệu suất nhân viên" />
          {topEmployees.length > 0 ? (
            <div className="space-y-4">
              {topEmployees.map((employee, index) => (
                <div key={employee.id} className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center bg-slate-100 text-sm font-black text-slate-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-[#0b1c30]">
                      {employee.full_name}
                    </p>
                    <p className="text-xs font-bold text-slate-400">
                      {employee.total_orders} đơn hàng
                    </p>
                  </div>
                  <p className="text-right font-black text-emerald-600">
                    {formatCompactCurrency(employee.total_revenue)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>Chưa có dữ liệu nhân viên</EmptyState>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}

export default DashboardPage;
