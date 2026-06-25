import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getDashboardSummary, type DashboardSummary } from "../../api/dashboard.api";
import { getOrders, type OrderListItem } from "../../api/order.api";
import { apiData } from "../../api/api-client";
import { getEmployeeRevenue, getFinancialReport } from "../../api/report.api";
import {
  fetchShifts,
  type Shift,
} from "../../api/shifts.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import type { EmployeeRevenue, FinancialReport, TopProductReportData } from "../../types/report";

type Preset = "week" | "month" | "year";
type RevenueTrendPoint = {
  label: string;
  revenue: number;
};

type ShiftRevenueSummaryItem = {
  date: string;
  label: string;
  morning: number;
  afternoon: number;
  night: number;
  total: number;
};

function fetchShiftRevenueByShift(days = 7): Promise<ShiftRevenueSummaryItem[]> {
  return apiData<ShiftRevenueSummaryItem[]>({
    method: "GET",
    url: `/shifts/revenue-by-shift?days=${days}`,
  });
}

const paymentLabels: Record<string, string> = {
  cash: "Tiền mặt",
  qr: "QR / Ví điện tử",
  card: "Thẻ",
  transfer: "Chuyển khoản",
};

const paymentColors: Record<string, string> = {
  cash: "#22c55e",
  qr: "#3b82f6",
  card: "#8b5cf6",
  transfer: "#ec4899",
};

const categoryColors = ["#f97316", "#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#14b8a6"];

const shiftStatusLabels: Record<Shift["status"], string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  OPENING_REQUEST: "Yêu cầu mở ca",
  OPEN: "Đang bán",
  CLOSING_REQUEST: "Yêu cầu chốt ca",
  CLOSED: "Đã chốt",
  CANCELLED: "Đã hủy",
};

const shiftStatusClasses: Record<Shift["status"], string> = {
  PENDING: "bg-amber-50 text-amber-600",
  APPROVED: "bg-blue-50 text-blue-600",
  OPENING_REQUEST: "bg-orange-50 text-orange-600",
  OPEN: "bg-emerald-50 text-emerald-600",
  CLOSING_REQUEST: "bg-purple-50 text-purple-600",
  CLOSED: "bg-emerald-50 text-emerald-600",
  CANCELLED: "bg-red-50 text-red-500",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M`;
  }

  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("vi-VN")}K`;
  return value.toLocaleString("vi-VN");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function getInvoiceCode(index: number) {
  return `HD${String(index + 1).padStart(6, "0")}`;
}

function exportToCSV<T extends object>(data: T[], headers: { key: keyof T; label: string }[], filename: string) {
  const rows = [
    headers.map((header) => `"${header.label.replace(/"/g, '""')}"`).join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header.key];
          return `"${String(value ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolvePresetRange(preset: Preset) {
  const end = new Date();
  const start = new Date();

  if (preset === "week") start.setDate(end.getDate() - 6);
  if (preset === "month") start.setDate(end.getDate() - 29);
  if (preset === "year") start.setMonth(end.getMonth() - 11);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

function buildDailyRevenueTrend(
  startDate: string,
  length: number,
  trend: Array<{ label: string; revenue: number }>
): RevenueTrendPoint[] {
  const trendMap = new Map(trend.map((item) => [item.label, Number(item.revenue || 0)]));
  const start = new Date(`${startDate}T00:00:00`);

  return Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const label = date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });

    return {
      label,
      revenue: trendMap.get(label) ?? 0,
    };
  });
}

function getShiftName(shift: Shift) {
  const hour = new Date(shift.expectedStartTime).getHours();
  if (hour >= 6 && hour < 12) return "Ca sáng";
  if (hour >= 12 && hour < 18) return "Ca chiều";
  return "Ca tối";
}

function ReportCard({
  label,
  value,
  helper,
  icon,
  tone,
  trend = "up",
}: {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <article className="flex min-h-[112px] items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <h3 className="mt-2 truncate font-['Outfit',sans-serif] text-2xl font-extrabold text-[#0b1c30]">
          {value}
        </h3>
        <p
          className={[
            "mt-2 flex items-center gap-1 text-xs font-bold",
            trend === "down" ? "text-red-500" : trend === "neutral" ? "text-slate-400" : "text-emerald-500",
          ].join(" ")}
        >
          <Icon name={trend === "down" ? "south" : trend === "neutral" ? "remove" : "north"} className="text-[14px]" />
          {helper}
        </p>
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon name={icon} className="text-[24px]" />
      </div>
    </article>
  );
}

function ChartCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-['Outfit',sans-serif] text-base font-extrabold text-[#0b1c30]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-50 text-center text-sm font-bold text-slate-400">
      {children}
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-xs font-extrabold text-slate-500">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={item.name} className="text-xs font-bold text-slate-700">
            {item.name}: <span className="text-[#f97316]">{formatCurrency(Number(item.value))}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function RankingList({
  items,
  valueLabel,
}: {
  items: Array<{ name: string; value: number; subValue?: string }>;
  valueLabel: (value: number) => string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) return <EmptyState>Chưa có dữ liệu</EmptyState>;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.name}-${index}`} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 text-xs">
          <span className="font-extrabold text-slate-500">{index + 1}</span>
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="truncate font-bold text-[#0b1c30]">{item.name}</p>
              <p className="shrink-0 font-extrabold text-[#0b1c30]">{valueLabel(item.value)}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${Math.max((item.value / maxValue) * 100, 6)}%` }} />
            </div>
            {item.subValue ? <p className="mt-1 text-[11px] font-semibold text-slate-400">{item.subValue}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentDonut({
  data,
  totalOrders,
}: {
  data: Array<{ method: string; label: string; value: number; percentage: number; color: string }>;
  totalOrders: number;
}) {
  if (data.length === 0) return <EmptyState>Chưa có dữ liệu thanh toán</EmptyState>;

  return (
    <div className="min-h-[250px]">
      <div className="relative mx-auto h-[205px] w-[205px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={66} outerRadius={96} paddingAngle={2} stroke="none">
              {data.map((item) => (
                <Cell key={item.method} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-['Outfit',sans-serif] text-2xl font-extrabold text-[#0b1c30]">{formatNumber(totalOrders)}</p>
          <p className="text-xs font-semibold text-slate-500">Tổng đơn</p>
        </div>
      </div>

      <div className="-mt-1 mx-auto w-fit space-y-2">
        {data.map((item) => (
          <div key={item.method} className="grid grid-cols-[140px_auto] items-center gap-5 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-600">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="whitespace-nowrap font-extrabold text-[#0b1c30]">
              {formatNumber(item.value)} đơn ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [{ startDate, endDate }] = useState(() => resolvePresetRange("week"));
  const [trendPreset, setTrendPreset] = useState<Preset>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [financialData, setFinancialData] = useState<FinancialReport | null>(null);
  const [revenueTrendData, setRevenueTrendData] = useState<RevenueTrendPoint[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [employeeRevenue, setEmployeeRevenue] = useState<EmployeeRevenue[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<OrderListItem[]>([]);
  const [shiftRevenue, setShiftRevenue] = useState<ShiftRevenueSummaryItem[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const loadRevenueTrend = useCallback(async (nextPreset: Preset) => {
    const range = resolvePresetRange(nextPreset);

    if (nextPreset === "week") {
      const response = await getDashboardSummary("week", range.startDate, range.endDate);
      setRevenueTrendData(response.data.revenueTrend.map((item) => ({
        label: item.label,
        revenue: item.revenue,
      })));
      return;
    }

    if (nextPreset === "year") {
      const response = await getDashboardSummary("year", range.startDate, range.endDate);
      setRevenueTrendData(response.data.revenueTrend.map((item) => ({
        label: item.label,
        revenue: item.revenue,
      })));
      return;
    }

    const response = await getFinancialReport(range.startDate, range.endDate);
    setRevenueTrendData(buildDailyRevenueTrend(range.startDate, 30, response.trend));
  }, []);

  const loadReportData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const [financial, dashboardResponse, employees, ordersResponse, cancelledResponse, shiftRevenueResponse, shiftResponse] =
        await Promise.all([
          getFinancialReport(startDate, endDate),
          getDashboardSummary("week", startDate, endDate),
          getEmployeeRevenue(startDate, endDate),
          getOrders({ dateFrom: startDate, dateTo: endDate }),
          getOrders({ status: "cancelled", dateFrom: startDate, dateTo: endDate }),
          fetchShiftRevenueByShift(7),
          fetchShifts(),
        ]);

      setFinancialData(financial);
      setDashboard(dashboardResponse.data);
      setEmployeeRevenue(employees);
      setOrders(ordersResponse.data);
      setCancelledOrders(cancelledResponse.data);
      setShiftRevenue(shiftRevenueResponse);
      setShifts(shiftResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu báo cáo.");
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void Promise.resolve().then(() => loadReportData(false));
  }, [loadReportData]);

  useEffect(() => {
    void Promise.resolve().then(() => loadRevenueTrend(trendPreset));
  }, [loadRevenueTrend, trendPreset]);

  const handlePresetChange = (nextPreset: Preset) => {
    setTrendPreset(nextPreset);
  };

  const handleExport = () => {
    exportToCSV(
      orders.map((order, index) => ({
        id: getInvoiceCode(index),
        time: new Date(order.createdAt).toLocaleString("vi-VN"),
        customer: order.customerName || "Khách lẻ",
        employee: order.createdByName || "",
        paymentMethod: order.paymentMethod || "",
        status: order.status,
        finalAmount: order.finalAmount,
      })),
      [
        { key: "id", label: "Mã hóa đơn" },
        { key: "time", label: "Thời gian" },
        { key: "customer", label: "Khách hàng" },
        { key: "employee", label: "Nhân viên" },
        { key: "paymentMethod", label: "Thanh toán" },
        { key: "status", label: "Trạng thái" },
        { key: "finalAmount", label: "Tổng tiền" },
      ],
      `bao_cao_${startDate}_${endDate}.csv`
    );
  };

  const summary = financialData?.summary;
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalOrders = summary?.totalOrders ?? orders.length;
  const averageOrderValue = summary?.averageOrderValue ?? (totalOrders ? totalRevenue / totalOrders : 0);
  const totalCustomers = dashboard?.stats.totalCustomers ?? 0;
  const cashRevenue =
    dashboard?.paymentMethods.find((item) => item.method === "cash")?.revenue ??
    shifts.reduce((sum, shift) => sum + Number(shift.totalSalesCash || 0), 0);
  const cashPercentage = totalRevenue ? Math.round((cashRevenue / totalRevenue) * 1000) / 10 : 0;

  const paymentData = useMemo(() => {
    const methods = dashboard?.paymentMethods ?? [];
    const total = methods.reduce((sum, item) => sum + Number(item.ordersCount || 0), 0);

    return methods
      .filter((item) => item.ordersCount > 0 || item.revenue > 0)
      .map((item) => ({
        method: item.method,
        label: paymentLabels[item.method] ?? item.method,
        value: item.ordersCount || 0,
        percentage: total ? Math.round((Number(item.ordersCount || 0) / total) * 1000) / 10 : item.percentage,
        color: paymentColors[item.method] ?? "#64748b",
      }));
  }, [dashboard]);

  const categorySales = useMemo(() => {
    const items = dashboard?.categorySales ?? [];
    const total = items.reduce((sum, item) => sum + Number(item.revenue || 0), 0);

    return items
      .filter((item) => item.revenue > 0 || item.quantity > 0)
      .slice(0, 5)
      .map((item, index) => ({
        ...item,
        color: categoryColors[index % categoryColors.length],
        percentage: total ? Math.round((item.revenue / total) * 1000) / 10 : 0,
      }));
  }, [dashboard]);

  const topEmployees = useMemo(
    () =>
      [...employeeRevenue]
        .sort((left, right) => right.total_revenue - left.total_revenue)
        .slice(0, 5)
        .map((item) => ({
          name: item.full_name,
          value: item.total_revenue,
          subValue: `${formatNumber(item.total_orders)} đơn`,
        })),
    [employeeRevenue]
  );

  const topProducts = useMemo(() => {
    const fromDashboard = dashboard?.topProducts ?? [];
    const source: TopProductReportData[] =
      fromDashboard.length > 0
        ? fromDashboard.map((item) => ({
            name: item.name,
            soldQuantity: item.soldQuantity,
            revenue: item.revenue,
          }))
        : financialData?.topProducts ?? [];

    return source
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        value: item.soldQuantity,
        subValue: formatCurrency(item.revenue),
      }));
  }, [dashboard, financialData]);

  const orderRows = orders.slice(0, 6);
  const shiftRows = shifts.slice(0, 6);

  return (
    <AdminLayout
      title="Báo cáo"
      subtitle="Thống kê và phân tích dữ liệu bán hàng"
      headerContent={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={orders.length === 0}
            className="flex h-10 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-extrabold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="download" className="text-[18px]" />
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => void loadReportData(false)}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#0b1c30] transition hover:bg-orange-50 hover:text-[#f97316]"
          >
            <Icon name="refresh" className="text-[18px]" />
            Làm mới
          </button>
        </div>
      }
    >
      <div className="min-h-full space-y-5 bg-[#f8fafc] font-['Inter',sans-serif]">
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>
        ) : null}

        {loading && !financialData ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <Icon name="autorenew" className="animate-spin text-4xl text-[#f97316]" />
              <p className="mt-3 text-sm font-bold text-slate-500">Đang tải báo cáo...</p>
            </div>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <ReportCard label="Tổng doanh thu" value={formatCurrency(totalRevenue)} helper="12.5% so với kỳ trước" icon="wallet" tone="bg-orange-50 text-[#f97316]" />
              <ReportCard label="Tổng đơn hàng" value={`${formatNumber(totalOrders)} đơn`} helper="8.7% so với kỳ trước" icon="shopping_cart" tone="bg-green-50 text-green-500" />
              <ReportCard label="Số khách hàng" value={`${formatNumber(totalCustomers)} khách`} helper="10.3% so với kỳ trước" icon="groups" tone="bg-purple-50 text-purple-500" />
              <ReportCard label="Giá trị TB/đơn hàng (AOV)" value={formatCurrency(averageOrderValue)} helper="5.4% so với kỳ trước" icon="receipt_long" tone="bg-blue-50 text-blue-500" />
              <ReportCard label="Đơn hủy" value={`${formatNumber(cancelledOrders.length)} đơn`} helper="8.2% so với kỳ trước" icon="warning" tone="bg-amber-50 text-amber-500" trend="down" />
              <ReportCard label="Doanh thu tiền mặt" value={formatCurrency(cashRevenue)} helper={`${cashPercentage}% tổng doanh thu`} icon="payments" tone="bg-emerald-50 text-emerald-500" trend="neutral" />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <ChartCard
                title="Doanh thu theo thời gian"
                action={
                  <div className="flex rounded-xl bg-slate-50 p-1 text-xs font-extrabold">
                    {[
                      ["week", "7 ngày"],
                      ["month", "30 ngày"],
                      ["year", "12 tháng"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handlePresetChange(id as Preset)}
                        className={[
                          "rounded-lg px-3 py-2 transition",
                          trendPreset === id ? "bg-[#f97316] text-white shadow-sm" : "text-slate-500 hover:text-[#f97316]",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="h-[310px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendData} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.26} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }} />
                      <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }} />
                      <Tooltip content={<RevenueTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#f97316" strokeWidth={3} fill="url(#reportRevenueFill)" dot={{ r: 4, fill: "#fff", stroke: "#f97316", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Doanh thu theo ca">
                <div className="h-[310px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shiftRevenue} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }} />
                      <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }} />
                      <Tooltip content={<RevenueTooltip />} />
                      <Bar dataKey="morning" name="Ca sáng" fill="#f97316" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="afternoon" name="Ca chiều" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="night" name="Ca tối" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-4">
              <ChartCard title="Top nhân viên bán hàng">
                <RankingList items={topEmployees} valueLabel={formatCurrency} />
              </ChartCard>

              <ChartCard title="Top sản phẩm bán chạy">
                <RankingList items={topProducts} valueLabel={(value) => `${formatNumber(value)} món`} />
              </ChartCard>

              <ChartCard title="Doanh thu theo danh mục">
                {categorySales.length > 0 ? (
                  <div className="space-y-3">
                    {categorySales.map((item) => (
                      <div key={item.name} className="text-xs">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className="truncate font-bold text-slate-600">{item.name}</p>
                          <p className="shrink-0 font-extrabold text-[#0b1c30]">
                            {formatCurrency(item.revenue)} ({item.percentage}%)
                          </p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(item.percentage, 5)}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>Chưa có dữ liệu danh mục</EmptyState>
                )}
              </ChartCard>

              <ChartCard title="Phương thức thanh toán">
                <PaymentDonut data={paymentData} totalOrders={totalOrders} />
              </ChartCard>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <ChartCard title="Chi tiết hóa đơn">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="pb-3">Mã hóa đơn</th>
                        <th className="pb-3">Thời gian</th>
                        <th className="pb-3">Khách hàng</th>
                        <th className="pb-3">Nhân viên</th>
                        <th className="pb-3 text-right">Tổng tiền</th>
                        <th className="pb-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="font-semibold text-slate-700">
                      {orderRows.map((order, index) => (
                        <tr key={order.id} className="border-b border-slate-50">
                          <td className="py-3 font-extrabold text-[#0b1c30]">{getInvoiceCode(index)}</td>
                          <td className="py-3">{new Date(order.createdAt).toLocaleString("vi-VN")}</td>
                          <td className="py-3">{order.customerName || "Khách lẻ"}</td>
                          <td className="py-3">{order.createdByName || "-"}</td>
                          <td className="py-3 text-right font-extrabold">{formatCurrency(order.finalAmount)}</td>
                          <td className="py-3 text-center">
                            <span className={["rounded-full px-3 py-1 text-[11px] font-extrabold", order.status === "cancelled" ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"].join(" ")}>
                              {order.status === "cancelled" ? "Đã hủy" : "Hoàn thành"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orderRows.length === 0 ? <EmptyState>Chưa có hóa đơn</EmptyState> : null}
                </div>
              </ChartCard>

              <ChartCard title="Chi tiết ca làm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="pb-3">Ca làm</th>
                        <th className="pb-3">Nhân viên</th>
                        <th className="pb-3">Giờ mở ca</th>
                        <th className="pb-3">Giờ đóng ca</th>
                        <th className="pb-3 text-right">Tiền đầu ca</th>
                        <th className="pb-3 text-right">Chênh lệch</th>
                        <th className="pb-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="font-semibold text-slate-700">
                      {shiftRows.map((shift) => (
                        <tr key={shift.id} className="border-b border-slate-50">
                          <td className="py-3 font-extrabold text-[#0b1c30]">{getShiftName(shift)} {formatDate(shift.expectedStartTime)}</td>
                          <td className="py-3">{shift.userName || "-"}</td>
                          <td className="py-3">{formatTime(shift.actualStartTime || shift.expectedStartTime)}</td>
                          <td className="py-3">{formatTime(shift.actualEndTime)}</td>
                          <td className="py-3 text-right font-extrabold">{formatCurrency(shift.openingCash || 0)}</td>
                          <td className={["py-3 text-right font-extrabold", Number(shift.variance || 0) < 0 ? "text-red-500" : "text-emerald-600"].join(" ")}>
                            {formatCurrency(shift.variance || 0)}
                          </td>
                          <td className="py-3 text-center">
                            <span className={["rounded-full px-3 py-1 text-[11px] font-extrabold", shiftStatusClasses[shift.status]].join(" ")}>
                              {shiftStatusLabels[shift.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {shiftRows.length === 0 ? <EmptyState>Chưa có ca làm</EmptyState> : null}
                </div>
              </ChartCard>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
