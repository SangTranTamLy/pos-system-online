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
import {
  getAiReportInsights,
  getEmployeeRevenue,
  getFinancialReport,
  type AiReportChart,
  type AiReportInsightData,
  type AiReportInsightResponse,
  type AiReportTable,
  type AiValidationResult,
} from "../../api/report.api";
import {
  fetchShifts,
  type Shift,
} from "../../api/shifts.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import type { EmployeeRevenue, FinancialReport, TopProductReportData } from "../../types/report";

type Preset = "week" | "month" | "year";
type ReportRangePreset = "last_7" | "last_30" | "last_90";
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

const paymentLabels: Record<string, string> = {
  cash: "Tiền mặt",
  qr: "QR / Ví điện tử",
  transfer: "Chuyển khoản",
};

const paymentColors: Record<string, string> = {
  cash: "#22c55e",
  qr: "#3b82f6",
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

function resolveReportRangePreset(preset: ReportRangePreset) {
  const end = new Date();
  const start = new Date();
  const days = preset === "last_7" ? 7 : preset === "last_90" ? 90 : 30;

  start.setDate(end.getDate() - (days - 1));

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

function buildShiftRevenueFromShifts(
  shifts: Shift[],
  startDate: string,
  endDate: string
): ShiftRevenueSummaryItem[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const rows = new Map<string, ShiftRevenueSummaryItem>();

  for (const shift of shifts) {
    const shiftDateValue = formatDateInput(new Date(shift.expectedStartTime));
    if (shiftDateValue < startDate || shiftDateValue > endDate) continue;

    if (!rows.has(shiftDateValue)) {
      rows.set(shiftDateValue, {
        date: shiftDateValue,
        label: formatDate(shiftDateValue),
        morning: 0,
        afternoon: 0,
        night: 0,
        total: 0,
      });
    }

    const row = rows.get(shiftDateValue)!;
    const hour = new Date(shift.expectedStartTime).getHours();
    const totalSales = Number(shift.totalSales || 0);

    if (hour >= 6 && hour < 12) row.morning += totalSales;
    else if (hour >= 12 && hour < 18) row.afternoon += totalSales;
    else row.night += totalSales;

    row.total += totalSales;
  }

  return Array.from(rows.values())
    .filter((row) => {
      const date = new Date(`${row.date}T00:00:00`);
      return date >= start && date <= end;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
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
          <Icon name={loading ? "sync" : "refresh"} className={`text-[18px] ${loading ? "animate-spin" : ""}`} />
          {loading ? "Đang phân tích..." : "Phân tích"}
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
void AiReportHeader;
void ExecutiveSummary;
void KeyMetricsTable;
void RevenueAnalysisReport;
void OperationAnalysisTable;
void CauseAnalysisTimeline;
void ActionPlanTable;
void WarningReportTable;
void AiDataTablesReportSection;
void AiChartReportSection;

const AI_EMPTY_TEXT = "Chưa đủ dữ liệu để phân tích.";
const AI_LOW_CONFIDENCE_NOTE = "Đây là nhận định tham khảo do dữ liệu chưa đầy đủ.";

type AiPanelData = NonNullable<AiReportInsightResponse["data"]>;
type AiChartSuggestion = NonNullable<AiPanelData["chart_suggestions"]>[number];
type AiReportMetrics = {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  bestSellingProduct: string;
  bestShift: string;
  cancelRate: number;
  cashRevenue: number;
};

function getAiText(value?: string) {
  return value?.trim() || AI_EMPTY_TEXT;
}

function isValidationPassed(validation?: { passed?: boolean }) {
  return validation?.passed !== false;
}

function getValidationText(validation?: { passed?: boolean; message?: string; failed_reason?: string }) {
  if (!validation) return "Validation: AI chưa gửi thông tin kiểm tra dữ liệu.";
  if (validation.passed === false) {
    return `Validation thất bại: ${validation.failed_reason || validation.message || "Dữ liệu chưa đủ để kết luận."}`;
  }

  return `Validation đạt: ${validation.message || "Dữ liệu đủ để đưa ra nhận định."}`;
}

function getConfidenceNote(confidenceScore?: number, confidence?: string) {
  const score = Number(confidenceScore ?? 0);
  if (score > 0 && score < 70) return AI_LOW_CONFIDENCE_NOTE;
  if (confidence === "thap") return AI_LOW_CONFIDENCE_NOTE;
  return "";
}

function getAiLabel(value: string | undefined, labels: Record<string, string>) {
  if (!value) return labels.thap || "Thấp";
  return labels[value] || value.replace(/_/g, " ");
}

function getAiPeriod(data?: AiPanelData | null) {
  const from = data?.meta?.period?.from;
  const to = data?.meta?.period?.to;
  if (!from || !to) return "Chưa đủ dữ liệu";
  return `${formatDate(from)} - ${formatDate(to)}`;
}

const confidenceLabels: Record<string, string> = {
  cao: "Cao",
  trung_binh: "Trung bình",
  thap: "Thấp",
};

const statusLabels: Record<string, string> = {
  can_cai_thien: "Cần cải thiện",
  on_dinh: "Ổn định",
  tot: "Tốt",
};

const priorityLabels: Record<string, string> = {
  cao: "Ưu tiên cao",
  trung_binh: "Ưu tiên trung bình",
  thap: "Ưu tiên thấp",
};

function getNormalizedAiData(response: AiReportInsightResponse | null) {
  const aiData = response?.data;
  const legacyChart = aiData?.bieu_do;
  const legacyInsights = [
    aiData?.du_bao_mai
      ? {
          data: "Dữ liệu POS được gửi cho AI.",
          validation: { passed: true, message: "Dữ liệu legacy đã có nội dung dự báo." },
          title: "Dự báo chuẩn bị hàng",
          description: aiData.du_bao_mai,
          evidence: "Dựa trên dữ liệu POS được gửi cho AI.",
          root_cause: AI_EMPTY_TEXT,
          confidence: aiData.meta?.confidence || "trung_binh",
          confidence_score: Number(aiData.meta?.score || 68),
          recommendation: aiData.du_bao_mai,
        }
      : null,
    aiData?.meo_doanh_thu
      ? {
          data: "Dữ liệu POS được gửi cho AI.",
          validation: { passed: true, message: "Dữ liệu legacy đã có nội dung gợi ý doanh thu." },
          title: "Gợi ý tăng doanh thu",
          description: aiData.meo_doanh_thu,
          evidence: "Dựa trên hành vi mua hàng trong dữ liệu POS.",
          root_cause: AI_EMPTY_TEXT,
          confidence: aiData.meta?.confidence || "trung_binh",
          confidence_score: Number(aiData.meta?.score || 68),
          recommendation: aiData.meo_doanh_thu,
        }
      : null,
    aiData?.canh_bao
      ? {
          data: "Dữ liệu tồn kho, ca làm hoặc đơn hủy.",
          validation: { passed: true, message: "Dữ liệu legacy đã có nội dung cảnh báo." },
          title: "Cảnh báo vận hành",
          description: aiData.canh_bao,
          evidence: "Dựa trên dữ liệu tồn kho, ca làm hoặc đơn hủy.",
          root_cause: AI_EMPTY_TEXT,
          confidence: aiData.meta?.confidence || "trung_binh",
          confidence_score: Number(aiData.meta?.score || 68),
          recommendation: "Kiểm tra lại dữ liệu vận hành liên quan.",
        }
      : null,
  ].filter(Boolean) as NonNullable<AiPanelData["insights"]>;

  return {
    meta: {
      assistant_name: aiData?.meta?.assistant_name || "QuickServe-AI",
      role: aiData?.meta?.role || "Trợ lý phân tích kinh doanh",
      confidence: aiData?.meta?.confidence || (response?.fallback ? "thap" : "trung_binh"),
      score: Number(aiData?.meta?.score ?? (response?.fallback ? 48 : 68)),
      confidence_note: aiData?.meta?.confidence_note,
      status: aiData?.meta?.status || (response?.fallback ? "can_cai_thien" : "on_dinh"),
      data_status: aiData?.meta?.data_status || (response?.fallback ? "thieu_du_lieu" : "du_du_lieu_co_ban"),
      period: aiData?.meta?.period,
    },
    summary: {
      main_insight: aiData?.summary?.main_insight || aiData?.du_bao_mai,
      revenue_text: aiData?.summary?.revenue_text,
      orders_text: aiData?.summary?.orders_text,
      best_selling_product: aiData?.summary?.best_selling_product,
      best_shift: aiData?.summary?.best_shift,
    },
    insights: aiData?.insights?.length ? aiData.insights : legacyInsights,
    possible_causes: aiData?.possible_causes || [],
    action_plan:
      aiData?.action_plan?.length
        ? aiData.action_plan
        : aiData?.meo_doanh_thu
          ? [
              {
                priority: "trung_binh",
                action: aiData.meo_doanh_thu,
                reason: "AI ghi nhận cơ hội tăng doanh thu từ dữ liệu POS.",
                expected_result: "Cải thiện giá trị trung bình mỗi đơn.",
              },
            ]
          : [],
    warnings:
      aiData?.warnings?.length
        ? aiData.warnings
        : aiData?.canh_bao
          ? [
              {
                type: "khac",
                level: "trung_binh",
                message: aiData.canh_bao,
                suggestion: "Theo dõi thêm dữ liệu trước khi áp dụng thay đổi lớn.",
              },
            ]
          : [],
    chart_suggestions:
      aiData?.chart_suggestions?.length
        ? aiData.chart_suggestions
        : legacyChart
          ? [
              {
                title: legacyChart.tieu_de,
                type: legacyChart.loai,
                labels: legacyChart.labels,
                datasets: legacyChart.datasets,
              },
            ]
          : [],
    report_tables: aiData?.report_tables,
  };
}

function AiReportHeader({ data, loading, onRefresh }: {
  data: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const ai = getNormalizedAiData(data);
  const confidence = String(ai.meta.confidence || "thap");
  const status = String(ai.meta.status || "can_cai_thien");
  const score = Math.max(0, Math.min(Number(ai.meta.score || 0), 100));
  const confidenceNote = score < 70 || confidence === "thap"
    ? ai.meta.confidence_note || AI_LOW_CONFIDENCE_NOTE
    : "";

  return (
    <header className="border-b border-slate-200 px-6 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#f97316]">
            Trợ lý phân tích kinh doanh
          </p>
          <h2 className="mt-1 font-['Outfit',sans-serif] text-2xl font-extrabold text-[#0b1c30]">
            Báo cáo phân tích kinh doanh
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{ai.meta.role}</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name={loading ? "sync" : "refresh"} className={`text-[18px] ${loading ? "animate-spin" : ""}`} />
          {loading ? "Đang phân tích..." : "Phân tích"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs md:grid-cols-4 xl:grid-cols-6">
        <ReportMeta label="Dữ liệu" value={getAiPeriod(data?.data)} />
        <ReportMeta label="Tạo lúc" value={new Date().toLocaleString("vi-VN")} />
        <ReportMeta label="Điểm AI" value={`${score}/100`} />
        <ReportMeta label="Trạng thái" value={getAiLabel(status, statusLabels)} />
        <ReportMeta
          label="Dữ liệu đầu vào"
          value={getAiLabel(String(ai.meta.data_status), {
            du_du_lieu_co_ban: "Đủ dữ liệu cơ bản",
            thieu_du_lieu: "Thiếu dữ liệu",
          })}
        />
      </div>
      {confidenceNote ? (
        <p className="mt-4 border-l-2 border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">
          {confidenceNote}
        </p>
      ) : null}
    </header>
  );
}

function ReportMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-orange-200 pl-3">
      <p className="font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-extrabold text-slate-800">{value || AI_EMPTY_TEXT}</p>
    </div>
  );
}

function ReportSectionTitle({ index, title }: { index: string; title: string }) {
  void index;

  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="h-2 w-2 rounded-full bg-[#f97316]" />
      <h3 className="font-['Outfit',sans-serif] text-base font-extrabold uppercase tracking-wide text-[#0b1c30]">
        {title}
      </h3>
    </div>
  );
}

function ExecutiveSummary({ data }: { data: AiReportInsightResponse | null }) {
  const ai = getNormalizedAiData(data);

  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="I." title="Tóm tắt điều hành" />
      <p className="max-w-6xl text-[15px] font-semibold leading-7 text-slate-800">
        {getAiText(ai.summary.main_insight)}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
        <p><span className="font-extrabold text-slate-950">Tình hình: </span>{getAiText(ai.summary.revenue_text)}</p>
        <p><span className="font-extrabold text-slate-950">Điểm nổi bật: </span>{getAiText(ai.summary.best_selling_product)}</p>
        <p><span className="font-extrabold text-slate-950">Cần chú ý: </span>{getAiText(data?.data?.canh_bao)}</p>
      </div>
    </section>
  );
}

function KeyMetricsTable({ data, metrics }: { data: AiReportInsightResponse | null; metrics: AiReportMetrics }) {
  const ai = getNormalizedAiData(data);
  const rows = [
    ["Doanh thu", formatCurrency(metrics.totalRevenue), AI_EMPTY_TEXT, getAiText(ai.summary.revenue_text)],
    ["Tổng đơn", `${formatNumber(metrics.totalOrders)} đơn`, AI_EMPTY_TEXT, getAiText(ai.summary.orders_text)],
    ["AOV", formatCurrency(metrics.averageOrderValue), AI_EMPTY_TEXT, "Giá trị trung bình mỗi hóa đơn."],
    ["Món bán chạy", metrics.bestSellingProduct || AI_EMPTY_TEXT, AI_EMPTY_TEXT, getAiText(ai.summary.best_selling_product)],
    ["Ca hiệu quả nhất", metrics.bestShift || AI_EMPTY_TEXT, AI_EMPTY_TEXT, getAiText(ai.summary.best_shift)],
    ["Tỷ lệ hủy đơn", `${metrics.cancelRate.toFixed(1)}%`, AI_EMPTY_TEXT, "Theo số đơn hủy trong khoảng lọc."],
    ["Doanh thu tiền mặt", formatCurrency(metrics.cashRevenue), AI_EMPTY_TEXT, "Tổng doanh thu thanh toán tiền mặt."],
  ];

  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="II." title="Tổng quan chỉ số kinh doanh" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3">Chỉ số</th>
              <th className="px-3 py-3">Giá trị</th>
              <th className="px-3 py-3">So với kỳ trước</th>
              <th className="px-3 py-3">Nhận xét</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value, compare, note]) => (
              <tr key={label} className="border-b border-slate-100">
                <td className="px-3 py-3 font-extrabold text-slate-950">{label}</td>
                <td className="px-3 py-3 font-bold text-slate-800">{value}</td>
                <td className="px-3 py-3 text-slate-500">{compare}</td>
                <td className="px-3 py-3 text-slate-600">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildAiChartData(chart?: AiChartSuggestion) {
  const dataset = chart?.datasets?.[0];
  return (chart?.labels || []).map((label, index) => ({
    label,
    value: Number(dataset?.data?.[index] || 0),
  }));
}

function RevenueAnalysisReport({ data }: { data: AiReportInsightResponse | null }) {
  const ai = getNormalizedAiData(data);
  const chart = ai.chart_suggestions[0];
  const chartData = buildAiChartData(chart);
  const hasChartData = chartData.some((item) => item.value > 0);
  const type = chart?.type || chart?.loai || "line";
  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="III." title="Phân tích doanh thu" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3 text-sm leading-6 text-slate-700">
          <p><span className="font-extrabold text-slate-950">Xu hướng doanh thu: </span>{getAiText(ai.summary.revenue_text)}</p>
          <p><span className="font-extrabold text-slate-950">Sản phẩm đóng góp: </span>{getAiText(ai.summary.best_selling_product)}</p>
          <p><span className="font-extrabold text-slate-950">Ca làm hiệu quả: </span>{getAiText(ai.summary.best_shift)}</p>
          <ul className="mt-4 space-y-2">
            {ai.insights.slice(0, 3).map((item, index) => (
              <li key={`${item.title}-${index}`} className="border-l-2 border-orange-200 pl-3">
                <p className="font-extrabold text-slate-900">{getAiText(item.title)}</p>
                <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  <p><span className="font-extrabold text-slate-800">Data: </span>{getAiText(item.data)}</p>
                  <p><span className="font-extrabold text-slate-800">Validation: </span>{getValidationText(item.validation)}</p>
                  <p>
                    <span className="font-extrabold text-slate-800">Insight: </span>
                    {isValidationPassed(item.validation) ? getAiText(item.description) : "Chưa đủ cơ sở kết luận."}
                  </p>
                  <p>
                    <span className="font-extrabold text-slate-800">Root Cause: </span>
                    {isValidationPassed(item.validation) ? getAiText(item.root_cause) : "Không phân tích nguyên nhân khi validation thất bại."}
                  </p>
                  <p>
                    <span className="font-extrabold text-slate-800">Confidence: </span>
                    {getAiLabel(String(item.confidence), confidenceLabels)}
                    {item.confidence_score ? ` (${item.confidence_score}/100)` : ""}
                  </p>
                  {getConfidenceNote(item.confidence_score, String(item.confidence)) ? (
                    <p className="font-semibold text-orange-700">{getConfidenceNote(item.confidence_score, String(item.confidence))}</p>
                  ) : null}
                  <p><span className="font-extrabold text-slate-800">Recommendation: </span>{getAiText(item.recommendation)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-h-[280px] border border-slate-200 bg-slate-50 p-3">
          {!hasChartData ? (
            <div className="flex h-[260px] items-center justify-center text-sm font-bold text-slate-400">
              AI chưa có đủ dữ liệu để vẽ biểu đồ đề xuất.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              {type === "bar" || type === "horizontal_bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={chartData}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.08} strokeWidth={2.5} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function OperationAnalysisTable({ data }: { data: AiReportInsightResponse | null }) {
  const warnings = getNormalizedAiData(data).warnings;
  const findWarning = (types: string[]) => warnings.find((warning) => types.includes(String(warning.type)));
  const rows = [
    ["Tồn kho", findWarning(["ton_kho", "inventory"])],
    ["Thanh toán", findWarning(["thanh_toan", "payment"])],
    ["Hóa đơn", findWarning(["hoa_don", "invoice", "doanh_thu"])],
    ["Nhân viên", findWarning(["nhan_vien", "employee"])],
    ["Sai lệch ca", findWarning(["ca_lam", "shift"])],
  ] as const;

  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="IV." title="Phân tích vận hành" />
      <ReportTable
        headers={["Hạng mục", "Trạng thái", "Nhận xét", "Gợi ý xử lý"]}
        rows={rows.map(([label, warning]) => [
          label,
          warning ? getAiLabel(String(warning.level), confidenceLabels) : AI_EMPTY_TEXT,
          warning
            ? isValidationPassed(warning.validation)
              ? getAiText(warning.message)
              : getValidationText(warning.validation)
            : AI_EMPTY_TEXT,
          warning ? getAiText(warning.suggestion) : AI_EMPTY_TEXT,
        ])}
      />
    </section>
  );
}

function CauseAnalysisTimeline({ data }: { data: AiReportInsightResponse | null }) {
  const causes = getNormalizedAiData(data).possible_causes;

  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="V." title="Nhận định nguyên nhân" />
      {causes.length ? (
        <div className="space-y-3">
          {causes.map((cause, index) => (
            <div key={`${cause.title}-${index}`} className="grid grid-cols-1 gap-3 border-l-2 border-orange-200 pl-4 text-sm md:grid-cols-3">
              <p><span className="font-extrabold text-slate-950">Data: </span>{getAiText(cause.data)}</p>
              <p><span className="font-extrabold text-slate-950">Validation: </span>{getValidationText(cause.validation)}</p>
              <p><span className="font-extrabold text-slate-950">Vấn đề: </span>{getAiText(cause.title)}</p>
              <p><span className="font-extrabold text-slate-950">Bằng chứng: </span>{getAiText(cause.evidence)}</p>
              <p>
                <span className="font-extrabold text-slate-950">Nguyên nhân có thể: </span>
                {isValidationPassed(cause.validation) ? getAiText(cause.description) : "Không phân tích nguyên nhân khi validation thất bại."}
              </p>
              <p>
                <span className="font-extrabold text-slate-950">Confidence: </span>
                {getAiLabel(String(cause.confidence), confidenceLabels)}
                {cause.confidence_score ? ` (${cause.confidence_score}/100)` : ""}
                {getConfidenceNote(cause.confidence_score, String(cause.confidence)) ? (
                  <span className="mt-1 block font-semibold text-orange-700">{getConfidenceNote(cause.confidence_score, String(cause.confidence))}</span>
                ) : null}
              </p>
              <p className="md:col-span-3"><span className="font-extrabold text-slate-950">Recommendation: </span>{getAiText(cause.recommendation)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-bold text-slate-400">{AI_EMPTY_TEXT}</p>
      )}
    </section>
  );
}

function ActionPlanTable({ data }: { data: AiReportInsightResponse | null }) {
  const actions = getNormalizedAiData(data).action_plan;
  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="VI." title="Kế hoạch hành động" />
      <ReportTable
        headers={["Ưu tiên", "Việc cần làm", "Lý do", "Kết quả kỳ vọng"]}
        rows={(actions.length ? actions : []).map((item) => [
          getAiLabel(String(item.priority), priorityLabels),
          getAiText(item.action),
          getAiText(item.reason),
          getAiText(item.expected_result),
        ])}
        emptyText={AI_EMPTY_TEXT}
      />
    </section>
  );
}

function WarningReportTable({ data }: { data: AiReportInsightResponse | null }) {
  const warnings = getNormalizedAiData(data).warnings;
  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="VII." title="Cảnh báo" />
      <ReportTable
        headers={["Loại cảnh báo", "Mức độ", "Nội dung", "Gợi ý xử lý"]}
        rows={warnings.map((warning) => [
          getAiLabel(warning.type, { doanh_thu: "Doanh thu", ton_kho: "Tồn kho", san_pham: "Món bán chậm", ca_lam: "Sai lệch ca", thanh_toan: "Thanh toán", khac: "Khác" }),
          getAiLabel(String(warning.level), confidenceLabels),
          isValidationPassed(warning.validation) ? getAiText(warning.message) : getValidationText(warning.validation),
          getAiText(warning.suggestion),
        ])}
        emptyText={AI_EMPTY_TEXT}
      />
    </section>
  );
}

function AiDataTablesReportSection({ data }: { data: AiReportInsightResponse | null }) {
  const tables = getNormalizedAiData(data).report_tables;
  const tableList: Array<{ key: string; table?: AiReportTable }> = [
    { key: "inventory", table: tables?.inventory_table },
    { key: "sales", table: tables?.sales_table },
    { key: "shift", table: tables?.shift_table },
    { key: "payment", table: tables?.payment_table },
    { key: "employee", table: tables?.employee_table },
  ];
  const visibleTables = tableList.filter(({ table }) => table?.columns?.length);

  return (
    <section className="border-b border-slate-200 px-6 py-5">
      <ReportSectionTitle index="VIII." title="Bảng dữ liệu phân tích" />
      {visibleTables.length ? (
        <div className="space-y-6">
          {visibleTables.map(({ key, table }) => (
            <div key={key}>
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
                  {table?.title || "Bảng dữ liệu"}
                </h4>
                {table?.validation_note ? (
                  <p className="text-xs font-semibold text-slate-400">{table.validation_note}</p>
                ) : null}
              </div>
              <ReportTable
                headers={(table?.columns || []).map(String)}
                rows={(table?.rows || []).map((row) => row.map((cell) => String(cell ?? "")))}
                emptyText="AI chưa có dữ liệu bảng này."
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-bold text-slate-400">AI chưa có bảng dữ liệu để hiển thị.</p>
      )}
    </section>
  );
}

function AiChartReportSection({ data }: { data: AiReportInsightResponse | null }) {
  const ai = getNormalizedAiData(data);
  const chart = ai.chart_suggestions[0];
  const chartData = buildAiChartData(chart);
  const hasChartData = chartData.some((item) => item.value > 0);
  const type = chart?.type || chart?.loai || "line";

  return (
    <section className="px-6 py-5">
      <ReportSectionTitle index="IX." title="Biểu đồ phân tích" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-3 text-sm leading-6 text-slate-700">
          <p className="font-extrabold uppercase tracking-wide text-slate-500">
            {chart?.title || chart?.tieu_de || "Biểu đồ AI đề xuất"}
          </p>
          <p>
            {hasChartData
              ? "AI chọn biểu đồ này để làm rõ xu hướng nổi bật trong khoảng dữ liệu đang xem."
              : "AI chưa có đủ dữ liệu để vẽ biểu đồ đề xuất."}
          </p>
          <p><span className="font-extrabold text-slate-950">Ngữ cảnh biểu đồ: </span>{getAiText(chart?.context_note)}</p>
          <p>
            <span className="font-extrabold text-slate-950">Loại biểu đồ: </span>
            {type}
          </p>
        </div>

        <div className="min-h-[300px] border border-slate-200 bg-white p-3">
          {!hasChartData ? (
            <div className="flex h-[280px] items-center justify-center border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
              AI chưa có đủ dữ liệu để vẽ biểu đồ đề xuất.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              {type === "bar" || type === "horizontal_bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={chartData}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.08} strokeWidth={2.5} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportTable({ headers, rows, emptyText = AI_EMPTY_TEXT }: { headers: string[]; rows: string[][]; emptyText?: string }) {
  if (!rows.length) return <p className="text-sm font-bold text-slate-400">{emptyText}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-y border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
            {headers.map((header) => (
              <th key={header} className="px-3 py-3">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className={["px-3 py-3 align-top", cellIndex === 0 ? "font-extrabold text-slate-950" : "text-slate-600"].join(" ")}>
                  {cell || AI_EMPTY_TEXT}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiBusinessReport({
  data,
  loading,
  onRefresh,
}: {
  data: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return <AiPaperBusinessReport data={data} loading={loading} onRefresh={onRefresh} />;
}

const AI_REPORT_EMPTY_TEXT = "Chưa đủ dữ liệu để phân tích.";
const AI_REPORT_LOW_CONFIDENCE_NOTE = "Đây là nhận định tham khảo do dữ liệu chưa đầy đủ.";

const aiPaperConfidenceLabels: Record<string, string> = {
  cao: "Cao",
  trung_binh: "Trung bình",
  thap: "Thấp",
};

const aiPaperStatusLabels: Record<string, string> = {
  can_cai_thien: "Cần cải thiện",
  on_dinh: "Ổn định",
  tot: "Tốt",
};

const aiPaperPriorityLabels: Record<string, string> = {
  cao: "Ưu tiên cao",
  trung_binh: "Ưu tiên trung bình",
  thap: "Ưu tiên thấp",
};

const aiPaperWarningTypeLabels: Record<string, string> = {
  doanh_thu: "Doanh thu",
  ton_kho: "Tồn kho",
  san_pham: "Món bán chậm",
  ca_lam: "Sai lệch ca",
  thanh_toan: "Thanh toán",
  khac: "Khác",
};

const emptyAiPaperData: AiReportInsightData = {
  meta: {
    assistant_name: "QuickServe-AI",
    role: "Trợ lý phân tích kinh doanh",
    period: { from: "", to: "" },
    confidence: "thap",
    score: 0,
    confidence_note: AI_REPORT_LOW_CONFIDENCE_NOTE,
    status: "can_cai_thien",
    data_status: "thieu_du_lieu",
  },
  summary: {
    main_insight: AI_REPORT_EMPTY_TEXT,
    revenue_text: AI_REPORT_EMPTY_TEXT,
    orders_text: AI_REPORT_EMPTY_TEXT,
    best_selling_product: AI_REPORT_EMPTY_TEXT,
    best_shift: AI_REPORT_EMPTY_TEXT,
  },
  insights: [],
  possible_causes: [],
  action_plan: [],
  warnings: [],
  report_tables: {},
  chart_suggestions: [],
};

function getAiPaperData(response: AiReportInsightResponse | null) {
  const source = response?.data || emptyAiPaperData;
  return {
    meta: {
      ...emptyAiPaperData.meta,
      ...(source.meta || {}),
      period: {
        ...emptyAiPaperData.meta?.period,
        ...(source.meta?.period || {}),
      },
    },
    summary: {
      ...emptyAiPaperData.summary,
      ...(source.summary || {}),
    },
    insights: Array.isArray(source.insights) ? source.insights : [],
    possible_causes: Array.isArray(source.possible_causes) ? source.possible_causes : [],
    action_plan: Array.isArray(source.action_plan) ? source.action_plan : [],
    warnings: Array.isArray(source.warnings) ? source.warnings : [],
    report_tables: source.report_tables || {},
    chart_suggestions: Array.isArray(source.chart_suggestions) ? source.chart_suggestions : [],
  };
}

function getAiPaperText(value?: string | null) {
  return value?.trim() || AI_REPORT_EMPTY_TEXT;
}

function getAiPaperLabel(value: string | undefined, labels: Record<string, string>, fallback = AI_REPORT_EMPTY_TEXT) {
  if (!value) return fallback;
  return labels[value] || value.replace(/_/g, " ");
}

function isAiFallbackReport(response: AiReportInsightResponse | null) {
  return Boolean(response?.fallback || (response?.data as { fallback?: boolean } | null)?.fallback);
}
function getAiPaperValidationText(validation?: AiValidationResult) {
  if (!validation) return "Chưa có bước validation từ AI.";
  if (validation.passed === false) {
    return validation.failed_reason || validation.message || "Chưa đủ cơ sở kết luận.";
  }

  return validation.message || "Dữ liệu đã qua kiểm tra ở mức cơ bản.";
}

function isAiPaperValidationPassed(validation?: AiValidationResult) {
  return validation?.passed !== false;
}

function getAiPaperConfidenceNote(score?: number, confidence?: string, note?: string) {
  const normalized = Number(score ?? 0);
  if ((normalized > 0 && normalized < 70) || confidence === "thap") {
    return note?.trim() || AI_REPORT_LOW_CONFIDENCE_NOTE;
  }

  return "";
}

function getAiPaperPeriod(data: ReturnType<typeof getAiPaperData>) {
  const from = data.meta.period?.from;
  const to = data.meta.period?.to;
  if (!from || !to) return AI_REPORT_EMPTY_TEXT;
  return `${formatDate(from)} - ${formatDate(to)}`;
}

function buildAiPaperChartData(chart?: AiReportChart) {
  const dataset = chart?.datasets?.[0];
  return (chart?.labels || []).map((label, index) => ({
    label,
    value: Number(dataset?.data?.[index] || 0),
  }));
}

function AiPaperSectionTitle({ index, title, helper }: { index: string; title: string; helper?: string }) {
  void index;
  void helper;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-[#f97316]" />
        <h3 className="font-['Outfit',sans-serif] text-base font-extrabold uppercase tracking-wide text-[#0b1c30]">
          {title}
        </h3>
      </div>
    </div>
  );
}

function AiPaperTable({
  headers,
  rows,
  emptyText = AI_REPORT_EMPTY_TEXT,
}: {
  headers: string[];
  rows: string[][];
  emptyText?: string;
}) {
  if (!rows.length) {
    return <p className="text-sm font-semibold text-slate-400">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-y border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            {headers.map((header) => (
              <th key={header} className="px-3 py-3">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className={[
                    "px-3 py-3 align-top leading-6",
                    cellIndex === 0 ? "font-extrabold text-slate-950" : "text-slate-700",
                  ].join(" ")}
                >
                  {cell || AI_REPORT_EMPTY_TEXT}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiPaperReportHeader({
  response,
  loading,
  onRefresh,
}: {
  response: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const ai = getAiPaperData(response);
  const score = Math.max(0, Math.min(Number(ai.meta.score || 0), 100));
  const status = getAiPaperLabel(String(ai.meta.status), aiPaperStatusLabels, "Cần cải thiện");
  const isFallback = isAiFallbackReport(response);
  const confidenceNote = getAiPaperConfidenceNote(score, String(ai.meta.confidence), ai.meta.confidence_note);

  return (
    <header className="border-b border-slate-200 px-6 py-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-orange-100 text-center">
            <div>
              <p className="text-lg font-extrabold text-[#0b1c30]">{score}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#f97316]">Điểm</p>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#f97316]">
                {ai.meta.assistant_name || "QuickServe-AI"} Business Report
              </p>
              <h2 className="mt-1 font-['Outfit',sans-serif] text-[28px] font-extrabold text-[#0b1c30]">
                Báo cáo phân tích kinh doanh
              </h2>
              <p className="text-sm font-semibold text-slate-500">{getAiPaperText(ai.meta.role)}</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[#b45309]">
                Dữ liệu: {getAiPaperPeriod(ai)}
              </span>
              <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
                Trạng thái: {status}
              </span>
              {isFallback ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                  Dữ liệu hệ thống
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name={loading ? "sync" : "refresh"} className={`text-[18px] ${loading ? "animate-spin" : ""}`} />
          {loading ? "Đang phân tích..." : "Phân tích"}
        </button>
      </div>

      {isFallback ? (
        <p className="mt-4 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          AI chưa khả dụng. Báo cáo hiện tại được tạo từ dữ liệu thật trong hệ thống.
        </p>
      ) : confidenceNote ? (
        <p className="mt-4 border-l-2 border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">
          {confidenceNote}
        </p>
      ) : null}
    </header>
  );
}

function AiPaperExecutiveSummary({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const firstWarning = ai.warnings[0];

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle
        index="I."
        title="Tóm tắt điều hành"
        helper="AI phải đi qua bước validation trước khi kết luận và đề xuất."
      />
      <p className="max-w-6xl text-[15px] font-semibold leading-7 text-slate-800">
        {getAiPaperText(ai.summary.main_insight)}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Tình hình</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{getAiPaperText(ai.summary.revenue_text)}</p>
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Điểm đáng chú ý</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{getAiPaperText(ai.summary.orders_text)}</p>
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Cần theo dõi</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{firstWarning ? getAiPaperText(firstWarning.message) : AI_REPORT_EMPTY_TEXT}</p>
        </div>
      </div>
    </section>
  );
}

function AiPaperMetricsSection({
  response,
  metrics,
}: {
  response: AiReportInsightResponse | null;
  metrics: AiReportMetrics;
}) {
  const ai = getAiPaperData(response);
  const rows = [
    ["Doanh thu", formatCurrency(metrics.totalRevenue), getAiPaperText(ai.summary.revenue_text), getAiPaperText(ai.summary.main_insight)],
    ["Số đơn", `${formatNumber(metrics.totalOrders)} đơn`, getAiPaperText(ai.summary.orders_text), "Tổng đơn trong khoảng báo cáo."],
    ["AOV", formatCurrency(metrics.averageOrderValue), "Giá trị trung bình mỗi hóa đơn.", getAiPaperText(ai.summary.orders_text)],
    ["Món bán chạy", metrics.bestSellingProduct || AI_REPORT_EMPTY_TEXT, "Lấy từ dữ liệu bán ra thực tế.", getAiPaperText(ai.summary.best_selling_product)],
    ["Ca hiệu quả nhất", metrics.bestShift || AI_REPORT_EMPTY_TEXT, "Lấy từ doanh thu theo ca/khung giờ.", getAiPaperText(ai.summary.best_shift)],
    ["Tỷ lệ hủy đơn", `${metrics.cancelRate.toFixed(1)}%`, "Tính theo số đơn hủy trong khoảng lọc.", "Dùng để kiểm tra rủi ro vận hành."],
    ["Doanh thu tiền mặt", formatCurrency(metrics.cashRevenue), "Lấy từ payment/shifts.", "Giúp đối chiếu chốt ca và dòng tiền mặt."],
  ];

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="II." title="Chỉ số chính" helper="Bảng này lấy số hệ thống thật và cho AI bổ sung nhận xét." />
      <AiPaperTable headers={["Chỉ số", "Giá trị", "Bằng chứng dữ liệu", "Nhận xét"]} rows={rows} />
    </section>
  );
}
void AiPaperMetricsSection;

function AiPaperInsightSection({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const rows = ai.insights.map((item) => [
    getAiPaperText(item.title),
    getAiPaperText(item.data),
    getAiPaperValidationText(item.validation),
    isAiPaperValidationPassed(item.validation) ? getAiPaperText(item.description) : "Chưa đủ cơ sở kết luận.",
    isAiPaperValidationPassed(item.validation) ? getAiPaperText(item.root_cause) : "Không phân tích nguyên nhân khi validation thất bại.",
    `${getAiPaperLabel(String(item.confidence), aiPaperConfidenceLabels, "Thấp")}${item.confidence_score ? ` (${item.confidence_score}/100)` : ""}`,
    [getAiPaperText(item.recommendation), getAiPaperConfidenceNote(item.confidence_score, String(item.confidence))].filter(Boolean).join(" "),
  ]);

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="III." title="AI phát hiện điều gì" helper="Mỗi hàng tương ứng một nhận định đã đi qua Data → Validation → Insight → Root Cause → Confidence → Recommendation." />
      <AiPaperTable
        headers={["Nhận định", "Data", "Validation", "Insight", "Root Cause", "Confidence", "Recommendation"]}
        rows={rows}
      />
    </section>
  );
}
void AiPaperInsightSection;

function AiPaperCauseSection({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const rows = ai.possible_causes.map((item) => [
    getAiPaperText(item.title),
    getAiPaperText(item.data),
    getAiPaperValidationText(item.validation),
    getAiPaperText(item.evidence),
    isAiPaperValidationPassed(item.validation) ? getAiPaperText(item.description) : "Chưa đủ cơ sở kết luận.",
    [getAiPaperText(item.recommendation), getAiPaperConfidenceNote(item.confidence_score, String(item.confidence))].filter(Boolean).join(" "),
  ]);

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="IV." title="Nguyên nhân có thể" helper="Chỉ nêu nguyên nhân khi có bằng chứng đủ rõ từ dữ liệu SQL trong context." />
      <AiPaperTable
        headers={["Vấn đề", "Data", "Validation", "Bằng chứng", "Nguyên nhân có thể", "Cách kiểm chứng / xử lý"]}
        rows={rows}
      />
    </section>
  );
}
void AiPaperCauseSection;

function buildAiInventoryGaugeData(table: AiReportTable | undefined) {
  return ((table?.rows || []) as unknown[][])
    .map((row) => {
      const name = String(row[0] ?? "");
      const currentStock = Number(row[2] ?? 0);
      const threshold = Number(row[3] ?? 0);
      const unit = String(row[4] ?? "");
      const ratio = threshold > 0 ? Math.max(0, Math.min((currentStock / threshold) * 100, 100)) : 0;

      return {
        name,
        currentStock: Number.isFinite(currentStock) ? currentStock : 0,
        threshold: Number.isFinite(threshold) ? threshold : 0,
        unit,
        ratio,
        tone: ratio <= 20 ? "bg-red-500" : ratio <= 60 ? "bg-orange-500" : "bg-amber-400",
      };
    })
    .filter((item) => item.name)
    .slice(0, 6);
}

function AiInventoryGaugeList({ table }: { table: AiReportTable | undefined }) {
  const items = buildAiInventoryGaugeData(table);

  if (!items.length) {
    return (
      <div className="border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-400">
        Chưa có mặt hàng tồn kho thấp cần hiển thị.
      </div>
    );
  }

  return (
    <div className="mb-5 border border-orange-100 bg-orange-50/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-800">
            Tồn kho cần chú ý
          </h4>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#f97316]">
          {formatNumber(items.length)} mặt hàng
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <div key={item.name} className="bg-white p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="text-sm font-extrabold text-slate-950">{item.name}</p>
              <p className="shrink-0 text-xs font-extrabold text-slate-600">
                {formatNumber(item.currentStock)} / {formatNumber(item.threshold)} {item.unit}
              </p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={["h-full rounded-full transition-all", item.tone].join(" ")}
                style={{ width: `${Math.max(item.ratio, 4)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-bold text-slate-500">
              Còn {item.ratio.toFixed(0)}% so với ngưỡng an toàn
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiPaperOperationSection({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const inventoryTable = ai.report_tables?.inventory_table;
  const warnings = ai.warnings || [];
  const findWarning = (type: string) => warnings.find((item) => String(item.type) === type);

  const rows = [
    [
      "Tồn kho",
      getAiPaperText(findWarning("ton_kho")?.message),
      getAiPaperText(findWarning("ton_kho")?.suggestion),
      getAiPaperValidationText(findWarning("ton_kho")?.validation),
    ],
    [
      "Thanh toán",
      getAiPaperText(findWarning("thanh_toan")?.message),
      getAiPaperText(findWarning("thanh_toan")?.suggestion),
      getAiPaperValidationText(findWarning("thanh_toan")?.validation),
    ],
    [
      "Hóa đơn",
      getAiPaperText(findWarning("doanh_thu")?.message),
      getAiPaperText(findWarning("doanh_thu")?.suggestion),
      getAiPaperValidationText(findWarning("doanh_thu")?.validation),
    ],
    [
      "Nhân viên",
      getAiPaperText(findWarning("khac")?.message),
      AI_REPORT_EMPTY_TEXT,
      getAiPaperValidationText(findWarning("khac")?.validation),
    ],
    [
      "Sai lệch ca",
      getAiPaperText(findWarning("ca_lam")?.message),
      getAiPaperText(findWarning("ca_lam")?.suggestion),
      getAiPaperValidationText(findWarning("ca_lam")?.validation),
    ],
  ];

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="V." title="Phân tích vận hành" helper="Gom các nhóm tồn kho, thanh toán, hóa đơn, nhân viên và ca làm thành một bảng đọc nhanh." />
      <p className="mb-4 text-sm font-semibold text-slate-600">
        Gom các nhóm tồn kho, thanh toán, hóa đơn, nhân viên và ca làm thành một bảng đọc nhanh.
      </p>
      <AiInventoryGaugeList table={inventoryTable} />
      <AiPaperTable headers={["Hạng mục", "Nhận xét", "Gợi ý xử lý", "Nguồn / Validation"]} rows={rows} />
    </section>
  );
}
void AiPaperOperationSection;

function AiPaperActionSection({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const actions = ai.action_plan.slice(0, 5);

  return (
    <div className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[#f97316]" />
          <h3 className="font-['Inter',system-ui,sans-serif] text-lg font-extrabold tracking-tight text-slate-950">
            CHIẾN LƯỢC HÀNH ĐỘNG
          </h3>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {(actions.length ? actions : []).map((item, index) => (
          <div key={`${item.action}-${index}`} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 bg-white px-4 py-3.5 transition-colors hover:bg-slate-50/70">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-orange-200 bg-white text-[11px] font-extrabold text-[#f97316]">
              {index + 1}
            </span>
            <p className="font-['Inter',system-ui,sans-serif] text-sm font-medium leading-6 text-slate-700">
              <span className="font-extrabold uppercase tracking-[0.02em] text-slate-950">
                Hành động {index + 1} — {getAiPaperText(item.action)}
              </span>
              {" "}
              <span className="font-semibold text-slate-600">
                [{getAiPaperLabel(String(item.priority), aiPaperPriorityLabels, "Ưu tiên trung bình")}]:
              </span>
              {" "}
              {getAiPaperText(item.reason)}
              {" "}
              <span className="font-semibold text-[#c2410c]">
                KPI mục tiêu: {getAiPaperText(item.expected_result)}
              </span>
            </p>
          </div>
        ))}
        {!actions.length ? (
          <div className="px-5 py-6 text-sm font-semibold text-slate-400">{AI_REPORT_EMPTY_TEXT}</div>
        ) : null}
      </div>
    </div>
  );
}

function AiPaperWarningSection({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const rows = ai.warnings.map((warning) => [
    getAiPaperLabel(String(warning.type), aiPaperWarningTypeLabels, "Khác"),
    getAiPaperLabel(String(warning.level), aiPaperConfidenceLabels, "Thấp"),
    isAiPaperValidationPassed(warning.validation) ? getAiPaperText(warning.message) : "Chưa đủ cơ sở kết luận.",
    getAiPaperText(warning.suggestion),
  ]);

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="VII." title="Cảnh báo" helper="Cảnh báo chỉ hợp lệ khi dữ liệu đã vượt qua bước validation." />
      <AiPaperTable headers={["Loại", "Mức độ", "Nội dung", "Gợi ý xử lý"]} rows={rows} />
    </section>
  );
}

function buildAiPaymentPieData(table: AiReportTable | undefined) {
  const rows = ((table?.rows || []) as unknown[][]).map((row, index) => {
    const method = String(row[0] ?? "");
    const orders = Number(row[1] ?? 0);

    return {
      method,
      label: paymentLabels[method] || method || "Khác",
      orders: Number.isFinite(orders) ? orders : 0,
      amount: String(row[2] ?? ""),
      color: paymentColors[method] || categoryColors[index % categoryColors.length],
      percentage: 0,
    };
  }).filter((item) => item.orders > 0);

  const totalOrders = rows.reduce((sum, item) => sum + item.orders, 0);

  return rows.map((item) => ({
    ...item,
    percentage: totalOrders ? (item.orders / totalOrders) * 100 : 0,
  }));
}

function AiPaperPaymentChart({ table }: { table: AiReportTable | undefined }) {
  const data = buildAiPaymentPieData(table);
  const totalOrders = data.reduce((sum, item) => sum + item.orders, 0);

  if (!data.length) {
    return <p className="text-sm font-semibold text-slate-400">AI chưa có dữ liệu thanh toán để vẽ biểu đồ.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="relative h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="orders"
              nameKey="label"
              innerRadius={70}
              outerRadius={102}
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={3}
            >
              {data.map((item) => (
                <Cell key={item.method} fill={item.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, payload) => [
                `${formatNumber(Number(value))} đơn`,
                payload?.payload?.label || "Phương thức",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-[#0b1c30]">{formatNumber(totalOrders)}</p>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Tổng đơn</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3">
        {data.map((item) => (
          <div key={item.method} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <div>
                  <p className="text-sm font-extrabold text-slate-950">{item.label}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatNumber(item.orders)} đơn</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold text-[#0b1c30]">{item.amount || "0đ"}</p>
                <p className="text-xs font-bold text-slate-500">{item.percentage.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
void AiPaperPaymentChart;

function parseAiPaperNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const normalized = raw.replace(/[^\d,.-]/g, "");
  const hasCommaDecimal = normalized.includes(",");
  const numericText = hasCommaDecimal
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized.replace(/[.,]/g, "");
  const parsed = Number(numericText);

  return Number.isFinite(parsed) ? parsed : 0;
}
function getAiPaperMetrics(ai: AiReportInsightData): AiReportMetrics {
  const salesRows = ((ai.report_tables?.sales_table?.rows || []) as unknown[][]);
  const paymentRows = ((ai.report_tables?.payment_table?.rows || []) as unknown[][]);
  const totalRevenue = paymentRows.reduce((sum, row) => sum + parseAiPaperNumber(row[2]), 0);
  const totalOrders = paymentRows.reduce((sum, row) => sum + parseAiPaperNumber(row[1]), 0);
  const topProduct = salesRows
    .map((row) => ({
      name: String(row[0] ?? ""),
      revenue: parseAiPaperNumber(row[2]),
    }))
    .sort((a, b) => b.revenue - a.revenue)[0];

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
    bestSellingProduct: topProduct?.name || ai.summary?.best_selling_product || "",
    bestShift: ai.summary?.best_shift || "",
    cancelRate: 0,
    cashRevenue: paymentRows
      .filter((row) => String(row[0] ?? "").toLowerCase().includes("cash"))
      .reduce((sum, row) => sum + parseAiPaperNumber(row[2]), 0),
  };
}
void getAiPaperMetrics;

function normalizeAiTableHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function findAiTableColumnIndex(
  table: AiReportTable | undefined,
  keywords: string[],
  fallbackIndex: number
) {
  const columns = table?.columns || [];
  const index = columns.findIndex((column) => {
    const normalizedColumn = normalizeAiTableHeader(column);
    return keywords.some((keyword) => normalizedColumn.includes(keyword));
  });

  return index >= 0 ? index : fallbackIndex;
}

function buildAiTopProductRevenueData(table: AiReportTable | undefined) {
  const productIndex = findAiTableColumnIndex(
    table,
    ["san pham", "product", "mat hang", "ten mon", "name"],
    0
  );
  const revenueIndex = findAiTableColumnIndex(
    table,
    ["doanh thu", "revenue", "line total", "line_total", "thanh tien", "tong tien", "amount"],
    2
  );
  const quantityIndex = findAiTableColumnIndex(
    table,
    ["so luong", "quantity", "sold"],
    1
  );
  const groupedProducts = new Map<string, { label: string; value: number; quantity: number }>();

  for (const row of (table?.rows || []) as unknown[][]) {
    const label = String(row[productIndex] ?? "").trim();
    const revenue = parseAiPaperNumber(row[revenueIndex]);
    const quantity = parseAiPaperNumber(row[quantityIndex]);

    if (!label || !revenue) continue;

    const current = groupedProducts.get(label) || { label, value: 0, quantity: 0 };
    current.value += revenue;
    current.quantity += quantity;
    groupedProducts.set(label, current);
  }

  return Array.from(groupedProducts.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
}

function truncateChartLabel(value: unknown, maxLength = 14) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function buildAiDailyRevenueData(response: AiReportInsightResponse | null) {
  const context = (response?.context || {}) as {
    trend?: Array<Record<string, unknown>>;
    financial?: { trend?: Array<Record<string, unknown>> };
  };
  const contextTrend = Array.isArray(context.trend)
    ? context.trend
    : Array.isArray(context.financial?.trend)
      ? context.financial.trend
      : [];

  const contextData = contextTrend
    .map((item) => ({
      label: String(item.label || item.date || item.day || ""),
      value: parseAiPaperNumber(item.revenue ?? item.totalRevenue ?? item.amount),
    }))
    .filter((item) => item.label && item.value > 0);

  if (contextData.length) return contextData;

  const ai = getAiPaperData(response);
  const dailyChart = ai.chart_suggestions.find((chart) => {
    const title = `${chart.title || chart.tieu_de || ""}`.toLowerCase();
    return title.includes("ngày") || title.includes("doanh thu");
  });

  return dailyChart ? buildAiPaperChartData(dailyChart).filter((item) => item.value > 0) : [];
}

function getPreferredAiTable(primary: AiReportTable | undefined, fallback: AiReportTable | undefined) {
  return primary?.rows?.length ? primary : fallback;
}

const topProductRevenueColors = ["#f97316", "#fb923c", "#f59e0b", "#64748b", "#94a3b8"];

function AiPaperTopProductRevenueChart({
  table,
}: {
  table: AiReportTable | undefined;
}) {
  const chartData = buildAiTopProductRevenueData(table);

  return (
    <article className="border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-700">
            Top 5 sản phẩm theo doanh thu
          </h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Lấy từ order_details/sales_table, sắp xếp theo doanh thu thực tế
          </p>
        </div>
      </div>

      <div className="h-[320px] p-4">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 18, left: 0, bottom: 34 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                height={44}
                tickFormatter={(value) => truncateChartLabel(value)}
                tickMargin={10}
                tick={{ fontSize: 11, fill: "#334155" }}
              />
              <YAxis
                tickFormatter={(value) => formatCompactCurrency(Number(value))}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip
                formatter={(value, _name, payload) => [
                  formatCurrency(Number(value)),
                  payload?.payload?.quantity
                    ? `Doanh thu (${formatNumber(Number(payload.payload.quantity))} món)`
                    : "Doanh thu",
                ]}
              />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {chartData.map((item, index) => (
                  <Cell
                    key={item.label}
                    fill={topProductRevenueColors[index % topProductRevenueColors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-50 text-center text-sm font-semibold text-slate-400">
            Chưa đủ dữ liệu doanh thu sản phẩm để vẽ biểu đồ.
          </div>
        )}
      </div>
    </article>
  );
}

function AiPaperDailyRevenueChart({ response }: { response: AiReportInsightResponse | null }) {
  const chartData = buildAiDailyRevenueData(response).slice(-7);

  return (
    <article className="border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-700">Biến động doanh thu theo ngày</h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">Lấy từ dữ liệu SQL theo khoảng lọc báo cáo</p>
        </div>
      </div>
      <div className="h-[320px] px-4 pb-4 pt-5">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 6, left: 0, bottom: 0 }}
              barCategoryGap="18%"
              barSize={38}
              maxBarSize={44}
            >
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={10}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tick={{ fontSize: 11, fill: "#334155" }}
              />
              <YAxis
                width={48}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tickFormatter={(value) => formatCompactCurrency(Number(value))}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((item, index) => (
                  <Cell
                    key={item.label}
                    fill={topProductRevenueColors[index % topProductRevenueColors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-50 text-center text-sm font-semibold text-slate-400">
            Chưa đủ dữ liệu doanh thu theo ngày để vẽ biểu đồ.
          </div>
        )}
      </div>
    </article>
  );
}

function AiPaperPaymentDonutFromTable({
  table,
}: {
  table: AiReportTable | undefined;
}) {
  const data = buildAiPaymentPieData(table);
  const totalOrders = data.reduce((sum, item) => sum + item.orders, 0);
  const renderPaymentLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    index,
  }: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    outerRadius?: number;
    index?: number;
  }) => {
    const item = typeof index === "number" ? data[index] : undefined;
    if (!item || !item.orders) return null;

    const radius = Number(outerRadius || 0) + 22;
    const angle = -Number(midAngle || 0) * (Math.PI / 180);
    const x = Number(cx || 0) + radius * Math.cos(angle);
    const y = Number(cy || 0) + radius * Math.sin(angle);
    const lineEndX = Number(cx || 0) + (radius - 8) * Math.cos(angle);
    const lineEndY = Number(cy || 0) + (radius - 8) * Math.sin(angle);
    const textAnchor = x > Number(cx || 0) ? "start" : "end";

    return (
      <g>
        <path
          d={`M${lineEndX},${lineEndY}L${x},${y}`}
          stroke={item.color}
          strokeWidth={1.5}
          fill="none"
        />
        <text
          x={x + (textAnchor === "start" ? 5 : -5)}
          y={y}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fill={item.color}
          fontSize={13}
          fontWeight={800}
        >
          {`${item.label} ${item.percentage.toFixed(0)}%`}
        </text>
      </g>
    );
  };

  return (
    <article className="border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-700">Phương thức thanh toán</h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatNumber(table?.rows?.length || 0)} dòng dữ liệu</p>
        </div>
      </div>

      <div className="p-4">
        <div className="relative h-[280px]">
          {data.length ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="orders"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                    labelLine={false}
                    label={renderPaymentLabel}
                  >
                    {data.map((item) => (
                      <Cell key={item.method} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${formatNumber(Number(value))} đơn`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-xl font-extrabold text-[#0b1c30]">{formatNumber(totalOrders)}</p>
                <p className="text-[11px] font-bold text-slate-500">Tổng đơn</p>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-50 text-center text-sm font-semibold text-slate-400">
              Chưa đủ dữ liệu để vẽ biểu đồ.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function buildAiCategoryDonutData(table: AiReportTable | undefined) {
  const rows = (table?.rows || [])
    .map((row, index) => ({
      id: `${String(row[0] ?? "category")}-${index}`,
      label: String(row[0] ?? "Khác").trim() || "Khác",
      revenue: parseAiPaperNumber(row[1]),
      quantity: parseAiPaperNumber(row[2]),
      color: categoryColors[index % categoryColors.length],
      percentage: 0,
    }))
    .filter((item) => item.revenue > 0);

  const totalRevenue = rows.reduce((sum, item) => sum + item.revenue, 0);

  return rows.map((item) => ({
    ...item,
    percentage: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0,
  }));
}

function AiPaperCategoryDonutFromTable({
  table,
}: {
  table: AiReportTable | undefined;
}) {
  const data = buildAiCategoryDonutData(table);
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const renderCategoryLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    index,
  }: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    outerRadius?: number;
    index?: number;
  }) => {
    const item = typeof index === "number" ? data[index] : undefined;
    if (!item || item.percentage < 3) return null;

    const radius = Number(outerRadius || 0) + 26;
    const angle = -Number(midAngle || 0) * (Math.PI / 180);
    const x = Number(cx || 0) + radius * Math.cos(angle);
    const y = Number(cy || 0) + radius * Math.sin(angle);
    const lineStartX = Number(cx || 0) + (Number(outerRadius || 0) + 2) * Math.cos(angle);
    const lineStartY = Number(cy || 0) + (Number(outerRadius || 0) + 2) * Math.sin(angle);
    const textAnchor = x > Number(cx || 0) ? "start" : "end";

    return (
      <g>
        <path
          d={`M${lineStartX},${lineStartY}L${x},${y}`}
          stroke={item.color}
          strokeWidth={1.4}
          fill="none"
        />
        <text
          x={x + (textAnchor === "start" ? 6 : -6)}
          y={y}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fill={item.color}
          fontSize={13}
          fontWeight={800}
        >
          {`${item.label} ${item.percentage.toFixed(0)}%`}
        </text>
      </g>
    );
  };

  return (
    <article className="border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-700">Cơ cấu doanh thu theo danh mục</h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {formatNumber(table?.rows?.length || 0)} dòng dữ liệu
          </p>
        </div>
      </div>

      <div className="relative h-[320px] p-4">
        {data.length ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 18, right: 54, bottom: 18, left: 54 }}>
                <Pie
                  data={data}
                  dataKey="revenue"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={3}
                  labelLine={false}
                  label={renderCategoryLabel}
                >
                  {data.map((item) => (
                    <Cell key={item.id} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, payload) => [
                    formatCurrency(Number(value)),
                    `${payload?.payload?.label || "Danh mục"} (${formatNumber(Number(payload?.payload?.quantity || 0))} món)`,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-lg font-extrabold text-[#0b1c30]">{formatCompactCurrency(totalRevenue)}</p>
              <p className="text-[11px] font-bold text-slate-500">Doanh thu</p>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-50 text-center text-sm font-semibold text-slate-400">
            Chưa đủ dữ liệu doanh thu danh mục để vẽ biểu đồ.
          </div>
        )}
      </div>
    </article>
  );
}

function AiPaperDataTablesSection({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const isFallback = isAiFallbackReport(response);
  const aiCharts = ai.chart_suggestions
    .filter((chart) => buildAiPaperChartData(chart).some((item) => item.value > 0))
    .slice(0, 4);
  const tables = ai.report_tables || {};
  const orderDetailsTable = getPreferredAiTable(tables.order_details_table, tables.sales_table);
  const categoriesTable = tables.categories_table;
  const hasAnyTable = [
    tables.orders_table,
    orderDetailsTable,
    tables.payment_table,
    categoriesTable,
  ].some((table) => table?.rows?.length);

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="VIII." title="Biểu đồ dữ liệu phân tích" helper="AI chọn 4 biểu đồ phù hợp từ dữ liệu bán hàng. Nếu AI chưa khả dụng, hệ thống dùng biểu đồ SQL dự phòng." />
      {!isFallback && aiCharts.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {aiCharts.map((chart, index) => (
            <AiPaperSingleChart key={`${chart.title || chart.tieu_de || "ai-chart"}-${index}`} chart={chart} />
          ))}
        </div>
      ) : hasAnyTable ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AiPaperCategoryDonutFromTable table={categoriesTable} />
            <AiPaperDailyRevenueChart response={response} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AiPaperTopProductRevenueChart table={orderDetailsTable} />
            <AiPaperPaymentDonutFromTable table={tables.payment_table} />
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-slate-400">AI chưa có dữ liệu để vẽ biểu đồ phân tích.</p>
      )}
    </section>
  );
}

function AiPaperDeepAnalysisSection({ response }: { response: AiReportInsightResponse | null }) {
  const fallbackAdvancedAnalysis = [
    {
      thu_tu: 1,
      loai: "xu_huong_doanh_thu",
      tieu_de: "Xu hướng doanh thu",
      noi_dung: "Chưa đủ dữ liệu để kết luận về xu hướng doanh thu.",
      muc_do: "neutral",
    },
    {
      thu_tu: 2,
      loai: "nguyen_nhan_bien_dong",
      tieu_de: "Nguyên nhân tăng hoặc giảm",
      noi_dung: "Chưa đủ dữ liệu để xác định nguyên nhân biến động doanh thu.",
      muc_do: "neutral",
    },
    {
      thu_tu: 3,
      loai: "san_pham",
      tieu_de: "Phân tích sản phẩm",
      noi_dung: "Chưa đủ dữ liệu để đánh giá xu hướng bán của sản phẩm.",
      muc_do: "neutral",
    },
    {
      thu_tu: 4,
      loai: "hanh_vi_mua",
      tieu_de: "Khách hàng và hành vi mua",
      noi_dung: "Chưa đủ dữ liệu để kết luận về hành vi mua hàng.",
      muc_do: "neutral",
    },
    {
      thu_tu: 5,
      loai: "rui_ro_co_hoi",
      tieu_de: "Rủi ro và cơ hội",
      noi_dung: "Chưa phát hiện đủ bằng chứng để xác định rủi ro hoặc cơ hội.",
      muc_do: "neutral",
    },
  ];
  const inputItems = Array.isArray(response?.data?.phan_tich_chuyen_sau)
    ? response?.data?.phan_tich_chuyen_sau || []
    : [];
  const compactItems = fallbackAdvancedAnalysis.map((fallback) => {
    const matched = inputItems.find((item) => item.loai === fallback.loai || item.thu_tu === fallback.thu_tu);
    return {
      ...fallback,
      ...matched,
      tieu_de: getAiPaperText(matched?.tieu_de || fallback.tieu_de),
      noi_dung: getAiPaperText(matched?.noi_dung || fallback.noi_dung),
      muc_do: matched?.muc_do || fallback.muc_do,
    };
  });
  return (
    <section className="px-6 py-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#f97316]" />
              <h3 className="font-['Inter',system-ui,sans-serif] text-lg font-extrabold tracking-tight text-slate-950">
                PHÂN TÍCH CHUYÊN SÂU
              </h3>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {compactItems.map((item) => (
              <div
                key={`${item.thu_tu}-${item.loai}`}
                className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-xs font-extrabold text-[#f97316] ring-1 ring-orange-100">
                  {String(item.thu_tu).padStart(2, "0")}
                </span>
                <p className="max-w-[1180px] font-['Inter',system-ui,sans-serif] text-sm font-medium leading-6 text-slate-700">
                  <span className="font-extrabold uppercase tracking-[0.02em] text-slate-950">
                    {item.tieu_de}:
                  </span>{" "}
                  {item.noi_dung}
                </p>
              </div>
            ))}
          </div>
        </div>

        <AiPaperActionSection response={response} />
      </div>
    </section>
  );
}

function AiPaperSingleChart({ chart }: { chart: AiReportChart }) {
  const type = chart.type || chart.loai || "line";
  const chartData = buildAiPaperChartData(chart);
  const hasChartData = chartData.some((item) => item.value > 0);

  return (
    <article className="border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h4 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-700">
          {chart.title || chart.tieu_de || "Biểu đồ AI đề xuất"}
        </h4>
        <p className="mt-1 text-xs font-medium text-slate-500">{getAiPaperText(chart.context_note)}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="space-y-3 text-sm leading-6 text-slate-700">
          <p><span className="font-extrabold text-slate-950">Loại biểu đồ: </span>{type}</p>
          <p><span className="font-extrabold text-slate-950">Số điểm dữ liệu: </span>{formatNumber(chartData.length)}</p>
          <p><span className="font-extrabold text-slate-950">Mô tả: </span>{getAiPaperText(chart.context_note)}</p>
        </div>
        <div className="min-h-[300px] border border-slate-200 bg-white p-3">
          {!hasChartData ? (
            <div className="flex h-[280px] items-center justify-center bg-slate-50 text-sm font-semibold text-slate-400">
              AI chưa có đủ dữ liệu để vẽ biểu đồ đề xuất.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              {type === "bar" || type === "horizontal_bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : type === "pie" ? (
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {chartData.map((_, index) => (
                      <Cell key={index} fill={categoryColors[index % categoryColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              ) : (
                <AreaChart data={chartData}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.08} strokeWidth={2.5} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </article>
  );
}

function AiPaperChartsSection({ response }: { response: AiReportInsightResponse | null }) {
  const charts = getAiPaperData(response).chart_suggestions;

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="IX." title="Biểu đồ phân tích" helper="Biểu đồ bám đúng dữ liệu thật, nếu thiếu dữ liệu sẽ hiện trạng thái rỗng." />
      {charts.length ? (
        <div className="space-y-5">
          {charts.map((chart, index) => (
            <AiPaperSingleChart key={`${chart.title || chart.tieu_de || "chart"}-${index}`} chart={chart} />
          ))}
        </div>
      ) : (
        <div className="border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-400">
          AI chưa có đủ dữ liệu để vẽ biểu đồ đề xuất.
        </div>
      )}
    </section>
  );
}
void AiPaperChartsSection;

function AiPaperBusinessReport({
  data,
  loading,
  onRefresh,
}: {
  data: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <section className="border border-slate-200 bg-white font-['Inter',system-ui,sans-serif]">
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-[#f97316]">
            <Icon name="sync" className="animate-spin text-[26px]" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#f97316]">
              QuickServe-AI Business Report
            </p>
            <h2 className="mt-2 font-['Outfit',sans-serif] text-2xl font-extrabold text-[#0b1c30]">
              Đang phân tích dữ liệu bán hàng
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Hệ thống đang gom dữ liệu và gửi sang AI. Báo cáo sẽ hiển thị sau khi phân tích xong.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden border border-slate-200 bg-white font-['Inter',system-ui,sans-serif]">
      <AiPaperReportHeader response={data} loading={loading} onRefresh={onRefresh} />
      <div className="divide-y divide-slate-200">
        <AiPaperExecutiveSummary response={data} />
        <AiPaperDataTablesSection response={data} />
        <AiPaperDeepAnalysisSection response={data} />
        <AiPaperWarningSection response={data} />
      </div>
    </section>
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

void shiftStatusLabels;
void shiftStatusClasses;
void formatTime;
void getShiftName;
void ChartCard;
void RankingList;
void PaymentDonut;
void RevenueTooltip;

export default function ReportsPage() {
  const initialRange = resolveReportRangePreset("last_30");
  const [rangePreset, setRangePreset] = useState<ReportRangePreset>("last_30");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
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
        shiftResponse,
      ] = await Promise.all([
        getFinancialReport(startDate, endDate),
        getDashboardSummary("week", startDate, endDate),
        getEmployeeRevenue(startDate, endDate),
        getOrders({ dateFrom: startDate, dateTo: endDate }),
        getOrders({ status: "cancelled", dateFrom: startDate, dateTo: endDate }),
        fetchShifts(),
      ]);

      setFinancialData(financial);
      setDashboard(dashboardResponse.data);
      setEmployeeRevenue(employees);
      setOrders(ordersResponse.data);
      setCancelledOrders(cancelledResponse.data);
      setShiftRevenue(buildShiftRevenueFromShifts(shiftResponse, startDate, endDate));
      setShifts(shiftResponse);

      try {
        const aiResponse = await getAiReportInsights(startDate, endDate);
        setAiInsights(aiResponse);
      } catch (aiError) {
        console.warn("Không tải được AI insights:", aiError);
        setAiInsights({
          success: false,
          fallback: true,
          data: null,
          message: "AI đang phản hồi chậm, báo cáo chính vẫn hiển thị bình thường.",
        });
      }
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

  const handleReportRangePresetChange = (nextPreset: ReportRangePreset) => {
    setRangePreset(nextPreset);
    const range = resolveReportRangePreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
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

  const bestShift = useMemo(() => {
    const totals = shiftRevenue.reduce(
      (acc, item) => ({
        morning: acc.morning + Number(item.morning || 0),
        afternoon: acc.afternoon + Number(item.afternoon || 0),
        night: acc.night + Number(item.night || 0),
      }),
      { morning: 0, afternoon: 0, night: 0 }
    );

    const shiftsByRevenue: Array<[string, number]> = [
      ["Ca sáng", totals.morning],
      ["Ca chiều", totals.afternoon],
      ["Ca tối", totals.night],
    ];
    const [label, value] = shiftsByRevenue.sort((left, right) => right[1] - left[1])[0];

    return value > 0 ? label : "";
  }, [shiftRevenue]);

  const aiReportMetrics: AiReportMetrics = {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    bestSellingProduct: topProducts[0]?.name || "",
    bestShift,
    cancelRate: totalOrders ? (cancelledOrders.length / totalOrders) * 100 : 0,
    cashRevenue,
  };
  void aiReportMetrics;

  const orderRows = orders.slice(0, 6);
  const shiftRows = shifts
    .filter((shift) => {
      const shiftDate = formatDateInput(new Date(shift.expectedStartTime));
      return shiftDate >= startDate && shiftDate <= endDate;
    })
    .slice(0, 6);
  const rangeLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  void revenueTrendData;
  void handlePresetChange;
  void paymentData;
  void categorySales;
  void topEmployees;
  void orderRows;
  void shiftRows;

  return (
    <AdminLayout
      title="Báo cáo"
      subtitle="Thống kê và phân tích dữ liệu bán hàng"
    >
      <div className="min-h-full space-y-5 bg-[#f8fafc] font-['Inter',sans-serif]">
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>
        ) : null}

        <section>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f97316]">
                Bộ lọc thời gian
              </p>
              <h2 className="mt-1 font-['Outfit',sans-serif] text-lg font-extrabold text-[#0b1c30]">
                Đang xem báo cáo: {rangeLabel}
              </h2>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative flex h-11 min-w-[220px] items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-[#0b1c30] shadow-sm transition focus-within:border-[#f97316] focus-within:ring-2 focus-within:ring-orange-100">
                <Icon name="calendar_today" className="mr-2 text-[18px] text-slate-400" />
                <select
                  value={rangePreset}
                  onChange={(event) => handleReportRangePresetChange(event.target.value as ReportRangePreset)}
                  className="h-full flex-1 appearance-none bg-transparent pr-8 font-extrabold outline-none"
                >
                  <option value="last_7">Xem 7 ngày gần đây</option>
                  <option value="last_30">Xem 30 ngày gần đây</option>
                  <option value="last_90">Xem 90 ngày gần đây</option>
                </select>
                <Icon name="expand_more" className="pointer-events-none absolute right-3 text-[20px] text-slate-400" />
              </label>

              <button
                type="button"
                onClick={handleExport}
                disabled={orders.length === 0}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-extrabold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="download" className="text-[18px]" />
                Xuất Excel
              </button>

              <button
                type="button"
                onClick={() => void loadReportData(false)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#0b1c30] transition hover:bg-orange-50 hover:text-[#f97316]"
              >
                <Icon name="refresh" className="text-[18px]" />
                Làm mới
              </button>
            </div>
          </div>
        </section>

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

            <AiBusinessReport
              data={aiInsights}
              loading={aiLoading}
              onRefresh={() => void loadReportData(true)}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}














