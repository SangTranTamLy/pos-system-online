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
import { getAiReportInsights, getEmployeeRevenue, getFinancialReport, type AiReportInsightResponse,
} from "../../api/report.api";
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

function AiReportInsightCard({data, loading, onRefresh,}: {
  data: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const aiData = data?.data;
  const chart = aiData?.bieu_do;
  const firstDataset = chart?.datasets?.[0];

  const aiChartData =
    chart?.labels?.map((label, index) => ({
      label,
      value: Number(firstDataset?.data?.[index] || 0),
    })) || [];

  const hasAiChartData = aiChartData.some((item) => item.value > 0);

  const insights = [
    {
      icon: "inventory_2",
      title: "Dự báo chuẩn bị hàng",
      description: aiData?.du_bao_mai || "Đang chờ dữ liệu AI để dự báo lượng chuẩn bị cho ngày mai.",
      tone: "border-blue-100 bg-blue-50/60 text-blue-600",
    },
    {
      icon: "tips_and_updates",
      title: "Gợi ý tăng doanh thu",
      description: aiData?.meo_doanh_thu || "Đang chờ AI gợi ý combo hoặc câu chào bán kèm phù hợp.",
      tone: "border-emerald-100 bg-emerald-50/60 text-emerald-600",
    },
    {
      icon: "warning",
      title: "Cảnh báo vận hành",
      description: aiData?.canh_bao || "Đang chờ AI kiểm tra tồn kho, món bán chậm và bất thường vận hành.",
      tone: "border-amber-100 bg-amber-50/70 text-amber-600",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Icon name="auto_awesome" className="text-[20px]" />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
                AI Business Assistant
              </p>
              <h2 className="font-['Outfit',sans-serif] text-xl font-extrabold text-slate-950">
                Trợ lý kinh doanh AI
              </h2>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Phân tích doanh thu, món bán chạy, tồn kho và vận hành để đề xuất hành động.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name={loading ? "sync" : "refresh"} className="text-[18px]" />
          {loading ? "Đang phân tích..." : "Làm mới AI"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {insights.map((item) => (
            <article
              key={item.title}
              className={`min-h-[150px] rounded-2xl border p-4 ${item.tone}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Icon name={item.icon} className="text-[23px]" />
                </div>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
                  AI Insight
                </span>
              </div>

              <h3 className="text-base font-extrabold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-2">
            <Icon name="query_stats" className="text-[22px] text-orange-300" />
            <h3 className="font-['Outfit',sans-serif] text-lg font-extrabold">
              Biểu đồ AI đề xuất
            </h3>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {aiData?.bieu_do?.tieu_de || "AI sẽ đề xuất biểu đồ khi có đủ dữ liệu bán hàng."}
          </p>

          <div className="mt-5 h-56 rounded-xl bg-white/10 p-3">
            {hasAiChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                {chart?.loai === "bar" ? (
                  <BarChart data={aiChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                    <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value" fill="#fb923c" radius={[8, 8, 0, 0]} />
                  </BarChart>
                ) : chart?.loai === "pie" ? (
                  <PieChart>
                    <Pie
                      data={aiChartData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {aiChartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={categoryColors[index % categoryColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                ) : (
                  <AreaChart data={aiChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                    <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#fb923c"
                      fill="#fb923c"
                      fillOpacity={0.25}
                      strokeWidth={3}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Icon name="bar_chart" className="text-[34px] text-slate-500" />
                <p className="mt-2 text-sm font-bold text-slate-300">
                  Chưa đủ dữ liệu để vẽ biểu đồ AI
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Kiểu phân tích
            </span>
            <span className="rounded-full bg-orange-400/20 px-3 py-1 text-xs font-extrabold text-orange-200">
              {chart?.loai || "line"}
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

void AiReportInsightCard;

function AiBusinessAnalysisPanel({
  data,
  loading,
  onRefresh,
}: {
  data: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const aiData = data?.data;
  const chart = aiData?.bieu_do;
  const firstDataset = chart?.datasets?.[0];
  const aiChartData =
    chart?.labels?.map((label, index) => ({
      label,
      value: Number(firstDataset?.data?.[index] || 0),
    })) || [];
  const hasAiChartData = aiChartData.some((item) => item.value > 0);
  const score = loading ? 0 : data?.fallback ? 68 : 86;
  const scoreLabel = data?.fallback ? "Can cai thien" : "Tot";

  const insightRows = [
    {
      icon: "inventory_2",
      label: "Du bao chuan bi hang",
      text: aiData?.du_bao_mai || "AI dang cho them du lieu de du bao luong hang can chuan bi.",
      tone: "bg-blue-600",
    },
    {
      icon: "trending_up",
      label: "Goi y tang doanh thu",
      text: aiData?.meo_doanh_thu || "AI dang phan tich combo va hanh vi mua de goi y ban kem.",
      tone: "bg-emerald-600",
    },
    {
      icon: "warning",
      label: "Canh bao van hanh",
      text: aiData?.canh_bao || "AI dang kiem tra ton kho, mon ban cham va bat thuong van hanh.",
      tone: "bg-amber-500",
    },
  ];

  const actionRows = [
    {
      label: "Hanh dong 1",
      text: aiData?.du_bao_mai || "Chuan bi them hang cho nhom mon co xu huong ban chay.",
      tone: "border-emerald-100 bg-emerald-50 text-emerald-700",
    },
    {
      label: "Hanh dong 2",
      text: aiData?.meo_doanh_thu || "Tao combo ban kem de tang gia tri trung binh moi don.",
      tone: "border-blue-100 bg-blue-50 text-blue-700",
    },
    {
      label: "Hanh dong 3",
      text: aiData?.canh_bao || "Kiem tra ton kho va cac bat thuong ve huy don, chot ca.",
      tone: "border-amber-100 bg-amber-50 text-amber-700",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#f59e0b ${score * 3.6}deg, #e5e7eb 0deg)`,
              }}
            >
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-lg font-extrabold text-slate-950">{score}</span>
                <span className="text-[9px] font-bold uppercase text-slate-400">diem</span>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-600">
              {scoreLabel}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Icon name="bolt" className="text-[18px]" />
              </span>
              <h2 className="font-['Outfit',sans-serif] text-lg font-extrabold text-slate-950">
                Bao cao Phan tich Kinh doanh AI
              </h2>
            </div>
            <p className="mt-2 max-w-5xl text-xs font-medium leading-5 text-slate-600">
              He thong AI tong hop doanh thu, san pham, ton kho va van hanh de tao goi y hanh dong cho quan.
              {data?.fallback ? " Hien dang hien thi goi y du phong vi AI gap loi." : " Ket qua duoc tao tu du lieu POS moi nhat."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name={loading ? "sync" : "refresh"} className="text-[17px]" />
          {loading ? "Dang phan tich" : "Lam moi AI"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
              Bieu do AI de xuat
            </h3>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-extrabold text-orange-600">
              {chart?.loai || "line"}
            </span>
          </div>

          <div className="h-56">
            {hasAiChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                {chart?.loai === "bar" ? (
                  <BarChart data={aiChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                ) : chart?.loai === "pie" ? (
                  <PieChart>
                    <Pie data={aiChartData} dataKey="value" nameKey="label" innerRadius={52} outerRadius={82}>
                      {aiChartData.map((_, index) => (
                        <Cell key={index} fill={categoryColors[index % categoryColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                ) : (
                  <AreaChart data={aiChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.14} strokeWidth={3} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl bg-slate-50 text-center">
                <Icon name="query_stats" className="text-[34px] text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-400">Chua du du lieu de ve bieu do AI</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-700">
            Phan tich chuyen sau
          </h3>
          <div className="space-y-3">
            {insightRows.map((item, index) => (
              <div key={item.label} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-extrabold text-white ${item.tone}`}>
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-extrabold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
          Chien luoc hanh dong
        </h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {actionRows.map((item) => (
            <div key={item.label} className={`rounded-lg border p-3 ${item.tone}`}>
              <p className="text-xs font-extrabold">{item.label}</p>
              <p className="mt-1 text-xs leading-5">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
  const [aiInsights, setAiInsights] = useState<AiReportInsightResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
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
      setAiLoading(true);

      const [
        financial,
        dashboardResponse,
        employees,
        ordersResponse,
        cancelledResponse,
        shiftRevenueResponse,
        shiftResponse,
        aiResponse,
      ] = await Promise.all([
        getFinancialReport(startDate, endDate),
        getDashboardSummary("week", startDate, endDate),
        getEmployeeRevenue(startDate, endDate),
        getOrders({ dateFrom: startDate, dateTo: endDate }),
        getOrders({ status: "cancelled", dateFrom: startDate, dateTo: endDate }),
        fetchShiftRevenueByShift(7),
        fetchShifts(),
        getAiReportInsights(startDate, endDate),
      ]);

      setFinancialData(financial);
      setDashboard(dashboardResponse.data);
      setEmployeeRevenue(employees);
      setOrders(ordersResponse.data);
      setCancelledOrders(cancelledResponse.data);
      setShiftRevenue(shiftRevenueResponse);
      setShifts(shiftResponse);
      setAiInsights(aiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu báo cáo.");
    } finally {
      setLoading(false);
      setAiLoading(false);
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

            <AiBusinessAnalysisPanel data={aiInsights} loading={aiLoading} onRefresh={() => void loadReportData(true)}/>

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
