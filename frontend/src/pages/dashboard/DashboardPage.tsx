import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
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
  type DashboardSummary,
} from "../../api/dashboard.api";
import { getEmployeeRevenue } from "../../api/report.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import type { EmployeeRevenue } from "../../types/report";

type StatTone = "orange" | "green" | "blue" | "purple" | "amber";

type StatCard = {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone: StatTone;
  action?: string;
  onAction?: () => void;
};

const toneClasses: Record<StatTone, string> = {
  orange: "bg-orange-50 text-[#f97316]",
  green: "bg-green-50 text-green-500",
  blue: "bg-blue-50 text-blue-500",
  purple: "bg-purple-50 text-purple-500",
  amber: "bg-amber-50 text-amber-500",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  qr: "QR / Ví điện tử",
  transfer: "Chuyển khoản",
};

const paymentMethodColors: Record<string, string> = {
  cash: "#3b82f6",
  qr: "#22c55e",
  transfer: "#fb923c",
};

const categoryBarColors = ["#f97316", "#3b82f6", "#22c55e", "#8b5cf6"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("vi-VN", {
      maximumFractionDigits: 1,
    })}M`;
  }

  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("vi-VN")}K`;
  return value.toLocaleString("vi-VN");
}

function getTodayInputValue() {
  return new Date().toISOString().split("T")[0];
}

function formatWeekdayDate(value: string) {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(date);
  const dateLabel = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return `${weekday} • ${dateLabel}`;
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function DashboardCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h3 className="font-['Outfit',sans-serif] text-base font-bold text-slate-900">
        {title}
      </h3>
      {action}
    </div>
  );
}

function StatCard({ card }: { card: StatCard }) {
  return (
    <article className="flex min-h-[128px] items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${toneClasses[card.tone]}`}>
        <Icon name={card.icon} className="text-[24px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-semibold text-slate-500">{card.label}</p>
        <p className="mb-1 font-['Outfit',sans-serif] text-xl font-bold text-slate-900">
          {card.value}
        </p>
        {card.action ? (
          <button
            type="button"
            onClick={card.onAction}
            className="text-[11px] font-bold text-[#f97316] hover:underline"
          >
            {card.action}
          </button>
        ) : (
          <p className="flex items-center gap-1 text-[11px] font-medium text-green-500">
            <Icon name="north" className="text-[13px]" />
            {card.helper}
          </p>
        )}
      </div>
    </article>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-bold text-slate-400">
      {children}
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [employeeRevenue, setEmployeeRevenue] = useState<EmployeeRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reportDate, setReportDate] = useState(getTodayInputValue);

  useEffect(() => {
    let isActive = true;

    async function loadDashboard(silent = false) {
      if (!silent) setIsLoading(true);

      try {
        const [dashboardResponse, employeeResponse] = await Promise.all([
          getDashboardSummary("week", reportDate, reportDate),
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
              : "Không tải được dữ liệu tổng quan."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(true), 60_000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [reportDate]);

  const stats = dashboard?.stats;
  const lowStockItems = dashboard?.lowStockItems ?? [];
  const paymentMethods = dashboard?.paymentMethods ?? [];
  const categorySales = dashboard?.categorySales ?? [];
  const topProducts = dashboard?.topProducts ?? [];
  const recentOrders = dashboard?.recentOrders ?? [];
  const totalRevenue = stats?.todayRevenue ?? 0;
  const totalOrders = stats?.todayOrders ?? 0;
  const todayInputValue = getTodayInputValue();
  const isToday = reportDate === todayInputValue;
  const reportDateLabel = formatDateLabel(reportDate);

  const paymentChartData = paymentMethods
    .filter((item) => item.revenue > 0 || item.ordersCount > 0)
    .map((item) => ({
      ...item,
      label: paymentMethodLabels[item.method] ?? item.method,
      color: paymentMethodColors[item.method] ?? "#64748b",
    }));
  const totalPaymentOrders = paymentChartData.reduce(
    (sum, item) => sum + Number(item.ordersCount || 0),
    0
  );
  const paymentOrderChartData = paymentChartData
    .filter((item) => Number(item.ordersCount || 0) > 0)
    .map((item) => ({
      ...item,
      orderPercentage: Math.round((Number(item.ordersCount || 0) / Math.max(totalPaymentOrders, 1)) * 100),
    }));

  const topEmployees = useMemo(
    () =>
      [...employeeRevenue]
        .sort((left, right) => right.total_revenue - left.total_revenue)
        .slice(0, 5),
    [employeeRevenue]
  );

  const cancelledOrders = recentOrders.filter((order) => order.status === "cancelled").length;
  const categorySalesTotal = categorySales.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
  const categorySalesBars = categorySales
    .filter((item) => Number(item.quantity || 0) > 0)
    .sort((left, right) => Number(right.quantity || 0) - Number(left.quantity || 0))
    .slice(0, 4)
    .map((item, index) => ({
      ...item,
      color: categoryBarColors[index % categoryBarColors.length],
      percentage: Math.round((Number(item.quantity || 0) / Math.max(categorySalesTotal, 1)) * 100),
    }));
  const statCards: StatCard[] = [
    {
      label: isToday ? "Doanh thu hôm nay" : "Doanh thu ngày chọn",
      value: formatCurrency(totalRevenue),
      helper: isToday ? "Theo dữ liệu hôm nay" : `Theo ngày ${reportDateLabel}`,
      icon: "wallet",
      tone: "orange",
    },
    {
      label: isToday ? "Đơn hàng hôm nay" : "Đơn hàng ngày chọn",
      value: `${totalOrders}`,
      helper: isToday ? "Theo dữ liệu hôm nay" : `Theo ngày ${reportDateLabel}`,
      icon: "shopping_bag",
      tone: "green",
    },
    {
      label: "Ca đang mở",
      value: dashboard?.currentShift ? "1" : "0",
      helper: dashboard?.currentShift ? dashboard.currentShift.userName : "Chưa có ca mở",
      icon: "work_history",
      tone: "purple",
    },
    {
      label: "Tổng khách hàng",
      value: `${stats?.totalCustomers ?? 0}`,
      helper: "12.5% so với hôm qua",
      icon: "groups",
      tone: "blue",
    },
    {
      label: "Tồn kho thấp",
      value: `${lowStockItems.length}`,
      helper: "",
      icon: "warning",
      tone: "amber",
      action: "Xem chi tiết",
      onAction: () => navigate("/stock"),
    },
  ];

  if (isLoading && !dashboard) {
    return (
      <AdminLayout title="Tổng quan" subtitle="Đang tải dữ liệu vận hành...">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
          Đang tải dữ liệu tổng quan...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Tổng quan"
      subtitle={
        isToday
          ? "Theo dõi doanh thu, đơn hàng và hoạt động kinh doanh hôm nay"
          : `Theo dõi doanh thu, đơn hàng và hoạt động kinh doanh ngày ${reportDateLabel}`
      }
    >
      <div className="min-h-full w-full space-y-6 overflow-x-hidden bg-[#f8fafc] font-['Inter',sans-serif]">
        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-['Outfit',sans-serif] text-base font-bold text-slate-900">
              Dữ liệu tổng quan
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Đang xem dữ liệu ngày {reportDateLabel}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
              <Icon name="calendar_month" className="text-[20px] text-[#f97316]" />
              <input
                type="date"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
                className="bg-transparent font-bold text-slate-900 outline-none"
              />
            </label>

            {!isToday ? (
              <button
                type="button"
                onClick={() => setReportDate(todayInputValue)}
                className="rounded-xl bg-[#f97316] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600"
              >
                Hôm nay
              </button>
            ) : null}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((card) => (
            <StatCard key={card.label} card={card} />
          ))}
        </section>

        <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          <DashboardCard className="h-full lg:col-span-3">
            <SectionHeader title="Doanh thu 7 ngày gần nhất" />

            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dashboard?.revenueTrend ?? []}
                  margin={{ top: 20, right: 24, left: 8, bottom: 12 }}
                >
                  <defs>
                    <linearGradient id="overviewRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="55%" stopColor="#f97316" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#eef2f7" vertical={false} strokeDasharray="4 4" />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    tickMargin={12}
                    tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                  />

                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), "Doanh thu"]}
                    labelStyle={{ fontWeight: 700, color: "#0f172a" }}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f97316"
                    strokeWidth={3}
                    fill="url(#overviewRevenueFill)"
                    dot={{
                      r: 4,
                      strokeWidth: 2,
                      fill: "#ffffff",
                      stroke: "#f97316",
                    }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 3,
                      fill: "#ffffff",
                      stroke: "#f97316",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          <DashboardCard className="h-full"> 
            <SectionHeader title="Phương thức thanh toán" /> {paymentOrderChartData.length > 0 ? ( <> 
            <style>
              {`@keyframes dashboardDonutReveal{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}
            </style>
            <div className="relative mx-auto mb-3 h-48 max-w-[220px] animate-[dashboardDonutReveal_520ms_cubic-bezier(0.22,1,0.36,1)_both]"> 
              <ResponsiveContainer width="100%" height="100%"> 
                <PieChart> <Pie data={paymentOrderChartData} 
                dataKey="ordersCount" 
                innerRadius={58} 
                outerRadius={86} 
                paddingAngle={3} 
                stroke="none"
                isAnimationActive={false}> 
                {paymentOrderChartData.map((item) => ( <Cell key={item.method} fill={item.color} /> ))} 
              </Pie> 
              </PieChart> 
              </ResponsiveContainer> 
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"> 
                <p className="text-sm font-bold text-slate-900">{totalPaymentOrders}</p>
                <p className="text-[10px] text-slate-500">Tổng đơn</p> 
                </div> 
                </div> <div className="mx-auto max-w-[260px] space-y-1.5"> {paymentOrderChartData.map((item) => ( <div key={item.method} className="flex items-center justify-between gap-3 text-xs"> 
                <span className="flex min-w-0 items-center gap-2 text-slate-600"> 
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /> 
                    <span className="truncate">{item.label}</span>
                  </span> 
                  <span className="shrink-0 font-bold text-slate-900"> {item.ordersCount} đơn ({item.orderPercentage}%) 
                </span> 
                </div> ))} 
                </div> </> ) : ( <EmptyState>Chưa có đơn thanh toán</EmptyState> )} 
          </DashboardCard>
          <DashboardCard className="h-full">
            <SectionHeader title="Đơn hàng gần đây" />
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.slice(0, 5).map((order, index) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900">HD{String(index + 1).padStart(6, "0")}</p>
                      <p className="truncate text-slate-500">{order.customerName || "Khách lẻ"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-extrabold text-slate-900">{formatCurrency(order.finalAmount)}</p>
                      <span className={["text-[11px] font-bold", order.status === "cancelled" ? "text-red-500" : "text-emerald-600"].join(" ")}>
                        {order.status === "cancelled" ? "Đã hủy" : "Hoàn thành"}
                      </span>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => navigate("/invoices")} className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-bold text-[#f97316] hover:underline">
                  Xem hóa đơn <Icon name="chevron_right" className="text-[14px]" />
                </button>
              </div>
            ) : (
              <EmptyState>Chưa có đơn hàng trong ngày này</EmptyState>
            )}
          </DashboardCard>

          <DashboardCard className="h-full">
            <SectionHeader title="Bán hàng theo danh mục" />
            {categorySalesBars.length > 0 ? (
              <div className="space-y-4">
                <style>
                  {`@keyframes categoryBarGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}
                </style>
                {categorySalesBars.map((item, index) => (
                  <div key={item.name} className="grid grid-cols-[minmax(96px,128px)_1fr_42px] items-center gap-3 text-xs">
                    <div className="flex min-w-0 items-center gap-2 font-bold text-slate-700">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-[15px]">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Icon name="category" className="text-[16px] text-slate-400" />
                        )}
                      </span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(item.percentage, 4)}%`,
                          backgroundColor: item.color,
                          transformOrigin: "left",
                          animation: `categoryBarGrow 900ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 90}ms both`,
                          willChange: "transform",
                        }}
                      />
                    </div>
                    <span className="text-right text-xs font-extrabold text-slate-900">
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Chưa có dữ liệu danh mục</EmptyState>
            )}
          </DashboardCard>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <DashboardCard className="flex h-full flex-col">
            <SectionHeader title="Top sản phẩm bán chạy" />
            {topProducts.length > 0 ? (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 font-semibold text-slate-400">
                      <th className="w-8 pb-3">#</th>
                      <th className="pb-3">Sản phẩm</th>
                      <th className="pb-3 text-right">Số lượng</th>
                      <th className="pb-3 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {topProducts.slice(0, 5).map((product, index) => (
                      <tr key={product.name} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="py-3">{index + 1}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-slate-100">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                              ) : (
                                <Icon name="local_cafe" className="text-[16px] text-slate-400" />
                              )}
                            </div>
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">{product.soldQuantity}</td>
                        <td className="py-3 text-right font-bold">{formatCurrency(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={() => navigate("/products")} className="mt-4 flex w-full items-center justify-center gap-1 text-center text-xs font-bold text-[#f97316] hover:underline">
                  Xem tất cả <Icon name="chevron_right" className="text-[14px]" />
                </button>
              </div>
            ) : (
              <EmptyState>Chưa có sản phẩm bán ra</EmptyState>
            )}
          </DashboardCard>

          <DashboardCard className="flex h-full flex-col">
            <SectionHeader title="Ca hiện tại" />
            {dashboard?.currentShift ? (
              <div className="flex flex-1 flex-col justify-between gap-4">
                <div className="rounded-xl bg-orange-50 p-4 text-[#f97316]">
                  <Icon name="work_history" className="text-[28px]" />
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide">Đang có ca mở</p>
                  <p className="mt-1 font-['Outfit',sans-serif] text-xl font-extrabold text-slate-900">
                    {dashboard.currentShift.userName}
                  </p>
                  <p className="mt-2 text-xs font-bold capitalize text-slate-500">
                    {formatWeekdayDate(dashboard.currentShift.expectedStartTime)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-bold text-slate-400">Bắt đầu</p>
                    <p className="mt-1 font-extrabold text-slate-900">
                      {new Date(dashboard.currentShift.expectedStartTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="font-bold text-slate-400">Kết thúc</p>
                    <p className="mt-1 font-extrabold text-slate-900">
                      {new Date(dashboard.currentShift.expectedEndTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => navigate("/shifts")} className="flex w-full items-center justify-center gap-1 text-xs font-bold text-[#f97316] hover:underline">
                  Xem ca làm <Icon name="chevron_right" className="text-[14px]" />
                </button>
              </div>
            ) : (
              <EmptyState>Chưa có ca đang mở</EmptyState>
            )}
          </DashboardCard>

          <DashboardCard className="flex h-full flex-col">
            <SectionHeader title="Cảnh báo" />
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-500">
                  <Icon name="warning" className="text-[20px]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Tồn kho thấp</p>
                  <p className="mt-0.5 text-xs text-slate-500">{lowStockItems.length} sản phẩm sắp hết hàng</p>
                </div>
                <button type="button" onClick={() => navigate("/stock")} className="whitespace-nowrap text-xs font-bold text-[#f97316] hover:underline">
                  Xem chi tiết
                </button>
              </div>
              <div className="flex items-start gap-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div className="rounded-lg bg-red-100 p-2 text-red-500">
                  <Icon name="error" className="text-[20px]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Đơn hàng hủy nhiều</p>
                  <p className="mt-0.5 text-xs text-slate-500">{cancelledOrders} đơn hàng đã bị hủy trong ngày này</p>
                </div>
                <button type="button" onClick={() => navigate("/invoices")} className="whitespace-nowrap text-xs font-bold text-[#f97316] hover:underline">
                  Xem chi tiết
                </button>
              </div>
              <div className="flex items-start gap-4 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                <div className="rounded-lg bg-purple-100 p-2 text-purple-500">
                  <Icon name="receipt_long" className="text-[20px]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Hiệu suất nhân viên</p>
                  <p className="mt-0.5 text-xs text-slate-500">{topEmployees.length} nhân viên có doanh thu trong ngày này</p>
                </div>
                <button type="button" onClick={() => navigate("/reports")} className="whitespace-nowrap text-xs font-bold text-[#f97316] hover:underline">
                  Xem chi tiết
                </button>
              </div>
            </div>
          </DashboardCard>
        </section>
      </div>
    </AdminLayout>
  );
}

export default DashboardPage;
