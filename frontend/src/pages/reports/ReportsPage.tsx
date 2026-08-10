import { useCallback, useEffect, useState } from "react";
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
import { useAppNotifications } from "../../components/common/AppNotificationsContext";
import type { FinancialReport } from "../../types/report";

type ReportRangePreset = "last_7" | "last_30" | "last_90";

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

function formatGrowth(value: number | null | undefined) {
  if (value === null || value === undefined) return "Chưa có dữ liệu kỳ trước";
  if (value === 0) return "Không đổi so với kỳ trước";
  return `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% ${value > 0 ? "tăng" : "giảm"} so với kỳ trước`;
}

function getGrowthTrend(value: number | null | undefined): "up" | "down" | "neutral" {
  if (value === null || value === undefined || value === 0) return "neutral";
  return value > 0 ? "up" : "down";
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

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function AiBusinessReport({
  data,
  loading,
  onRefresh,
  financialTrend,
}: {
  data: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
  financialTrend: FinancialReport["trend"];
}) {
  return (
    <AiPaperBusinessReport
      data={data}
      loading={loading}
      onRefresh={onRefresh}
      financialTrend={financialTrend}
    />
  );
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
  don_huy: "Đơn hủy",
  ton_kho: "Tồn kho",
  san_pham: "Món bán chậm",
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
  const contextCoverageScore = response?.context?.dataQuality?.coverageScore;
  const scoreSource = Number.isFinite(Number(contextCoverageScore))
    ? Number(contextCoverageScore)
    : Number(ai.meta.score || 0);
  const score = Math.max(0, Math.min(scoreSource, 95));
  const status = getAiPaperLabel(String(ai.meta.status), aiPaperStatusLabels, "Cần cải thiện");
  const confidenceNote = getAiPaperConfidenceNote(score, String(ai.meta.confidence), ai.meta.confidence_note);
  const evaluation = response?.evaluation;
  const evaluationAccepted = evaluation?.status === "accepted";

  return (
    <header className="border-b border-slate-200 px-6 py-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-orange-100 text-center">
            <div>
              <p className="text-lg font-extrabold text-[#0b1c30]">{score}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#f97316]">Dữ liệu</p>
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

              {evaluationAccepted ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                  Đã kiểm tra dựa trên dữ liệu hệ thống
                </span>
              ) : evaluation?.status === "rejected" ? (
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                  Kết quả AI chưa được chấp nhận
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
          <Icon name={loading ? "sync" : "insights"} className={`text-[18px] ${loading ? "animate-spin" : ""}`} />
          {loading ? "Đang phân tích..." : "Phân tích"}
        </button>
      </div>

      {confidenceNote ? (
        <p className="mt-4 border-l-2 border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">
          {confidenceNote}
        </p>
      ) : null}
    </header>
  );
}

function AiPaperExecutiveSummary({ response }: { response: AiReportInsightResponse | null }) {
  const ai = getAiPaperData(response);
  const primaryAction = ai.action_plan[0];
  const priorityActionText = primaryAction
    ? [getAiPaperText(primaryAction.action), getAiPaperText(primaryAction.expected_result)].filter(Boolean).join(" Kỳ vọng: ")
    : AI_REPORT_EMPTY_TEXT;

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle
        index="I."
        title="Tóm tắt điều hành"
        helper="Tóm tắt nhanh tình hình, điểm đáng chú ý và việc nên ưu tiên làm ngay."
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
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Hành động ưu tiên</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{priorityActionText}</p>
        </div>
      </div>
    </section>
  );
}

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

function buildAiDailyRevenueData(
  response: AiReportInsightResponse | null,
  financialTrend: FinancialReport["trend"] = []
) {
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

  const financialData = financialTrend
    .map((item) => ({
      label: String(item.label || ""),
      value: parseAiPaperNumber(item.revenue),
    }))
    .filter((item) => item.label && item.value > 0);

  if (financialData.length) return financialData;

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

function AiPaperDailyRevenueChart({
  response,
  financialTrend,
}: {
  response: AiReportInsightResponse | null;
  financialTrend?: FinancialReport["trend"];
}) {
  const chartData = buildAiDailyRevenueData(response, financialTrend).slice(-7);

  return (
    <article className="border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-700">Biến động doanh thu theo ngày</h4>
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

function buildAiMaterialPurchaseDonutData(table: AiReportTable | undefined) {
  const rows = (table?.rows || [])
    .map((row, index) => ({
      id: `${String(row[0] ?? "material")}-${index}`,
      label: String(row[0] ?? "Nguyên liệu").trim() || "Nguyên liệu",
      quantity: parseAiPaperNumber(row[1]),
      unit: String(row[2] ?? "").trim(),
      averageUnitPrice: parseAiPaperNumber(row[3]),
      totalCost: parseAiPaperNumber(row[4]),
      color: categoryColors[index % categoryColors.length],
      percentage: 0,
    }))
    .filter((item) => item.totalCost > 0);

  const totalCost = rows.reduce((sum, item) => sum + item.totalCost, 0);

  return rows.map((item) => ({
    ...item,
    percentage: totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0,
  }));
}

function AiPaperMaterialPurchaseDonutFromTable({
  table,
}: {
  table: AiReportTable | undefined;
}) {
  const data = buildAiMaterialPurchaseDonutData(table);
  const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0);
  const renderMaterialLabel = ({
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
    if (!item || item.percentage < 5) return null;

    const radius = Number(outerRadius || 0) + 22;
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
          strokeWidth={1.5}
          fill="none"
        />
        <text
          x={x + (textAnchor === "start" ? 4 : -4)}
          y={y}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fill={item.color}
          fontSize={11}
          fontWeight={800}
        >
          {`${truncateChartLabel(item.label, 12)} ${item.percentage.toFixed(0)}%`}
        </text>
      </g>
    );
  };

  return (
    <article className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h4 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-700">
          Cơ cấu chi phí nhập nguyên liệu
        </h4>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {table?.validation_note || `${formatNumber(data.length)} nguyên liệu có chi phí nhập`}
        </p>
      </div>

      <div className="relative h-[320px] p-4">
        {data.length ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 22, right: 42, bottom: 22, left: 42 }}>
                <Pie
                  data={data}
                  dataKey="totalCost"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={86}
                  paddingAngle={3}
                  labelLine={false}
                  label={renderMaterialLabel}
                >
                  {data.map((item) => (
                    <Cell key={item.id} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, payload) => [
                    formatCurrency(Number(value)),
                    `${payload?.payload?.label || "Nguyên liệu"}: nhập ${formatNumber(Number(payload?.payload?.quantity || 0))} ${payload?.payload?.unit || ""} trong kỳ · TB ${formatCurrency(Number(payload?.payload?.averageUnitPrice || 0))}`,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-lg font-extrabold text-[#0b1c30]">{formatCompactCurrency(totalCost)}</p>
              <p className="text-[11px] font-bold text-slate-500">Chi phí nhập</p>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-50 text-center text-sm font-semibold text-slate-400">
            Chưa có chi phí nhập nguyên liệu trong kỳ.
          </div>
        )}
      </div>
    </article>
  );
}

function AiPaperDataTablesSection({
  response,
  financialTrend,
}: {
  response: AiReportInsightResponse | null;
  financialTrend: FinancialReport["trend"];
}) {
  const ai = getAiPaperData(response);
  const aiCharts = ai.chart_suggestions
    .filter((chart) => buildAiPaperChartData(chart).some((item) => item.value > 0))
    .slice(0, 4);
  const tables = ai.report_tables || {};
  const orderDetailsTable = getPreferredAiTable(tables.order_details_table, tables.sales_table);
  const categoriesTable = tables.categories_table;
  const materialPurchaseTable = tables.material_purchase_table;
  const hasAnyTable = [
    tables.orders_table,
    orderDetailsTable,
    tables.payment_table,
    categoriesTable,
    materialPurchaseTable,
  ].some((table) => table?.rows?.length);

  return (
    <section className="px-6 py-5">
      <AiPaperSectionTitle index="VIII." title="Biểu đồ dữ liệu phân tích" helper="Biểu đồ được dựng trực tiếp từ dữ liệu bán hàng và nhập kho của hệ thống." />
      {aiCharts.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {aiCharts.slice(0, 2).map((chart, index) => (
            <AiPaperSingleChart key={`${chart.title || chart.tieu_de || "ai-chart"}-${index}`} chart={chart} />
          ))}
          <AiPaperMaterialPurchaseDonutFromTable table={materialPurchaseTable} />
        </div>
      ) : hasAnyTable ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <AiPaperCategoryDonutFromTable table={categoriesTable} />
            <AiPaperDailyRevenueChart response={response} financialTrend={financialTrend} />
            <AiPaperMaterialPurchaseDonutFromTable table={materialPurchaseTable} />
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
  const compactItems = Array.isArray(response?.data?.phan_tich_chuyen_sau)
    ? response?.data?.phan_tich_chuyen_sau || []
    : [];

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

function AiPaperBusinessReport({
  data,
  loading,
  onRefresh,
  financialTrend,
}: {
  data: AiReportInsightResponse | null;
  loading: boolean;
  onRefresh: () => void;
  financialTrend: FinancialReport["trend"];
}) {
  if (loading) {
    return (
      <section className="border border-slate-200 bg-white font-['Inter',system-ui,sans-serif]">
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
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

  if (!data?.success || !data.data) {
    return (
      <section className="border border-slate-200 bg-white px-5 py-3 font-['Inter',system-ui,sans-serif]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#f97316]">
              QuickServe-AI
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-extrabold text-[#0b1c30]">Trợ lý phân tích kinh doanh</h2>
              <p className={`text-sm font-medium ${data?.message ? "text-red-600" : "text-slate-500"}`}>
                {data?.message || "Bấm Phân tích để tạo báo cáo."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800"
          >
            <Icon name="insights" className="text-[18px]" />
            Phân tích
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden border border-slate-200 bg-white font-['Inter',system-ui,sans-serif]">
      <AiPaperReportHeader response={data} loading={loading} onRefresh={onRefresh} />
      <div className="divide-y divide-slate-200">
        <AiPaperExecutiveSummary response={data} />
        <AiPaperDataTablesSection response={data} financialTrend={financialTrend} />
        <AiPaperDeepAnalysisSection response={data} />
        <AiPaperWarningSection response={data} />
      </div>
    </section>
  );
}
export default function ReportsPage() {
  const { notify } = useAppNotifications();
  const initialRange = resolveReportRangePreset("last_30");
  const [rangePreset, setRangePreset] = useState<ReportRangePreset>("last_30");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [loading, setLoading] = useState(true);

  const [financialData, setFinancialData] = useState<FinancialReport | null>(null);
  const [aiInsights, setAiInsights] = useState<AiReportInsightResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const loadReportData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);


    try {
      const [
        financial,
        dashboardResponse,
        ordersResponse,
        shiftResponse,
      ] = await Promise.all([
        getFinancialReport(startDate, endDate),
        getDashboardSummary("week", startDate, endDate),
        getOrders({ dateFrom: startDate, dateTo: endDate }),
        fetchShifts(),
      ]);

      setFinancialData(financial);
      setDashboard(dashboardResponse.data);
      setOrders(ordersResponse.data);
      setShifts(shiftResponse);
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : "Không tải được dữ liệu báo cáo.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  const analyzeWithAi = useCallback(async () => {
    setAiLoading(true);
    setAiInsights(null);

    try {
      const response = await getAiReportInsights(
        startDate,
        endDate
      );

      setAiInsights(response);
    } catch (error) {
      setAiInsights({
        success: false,
        data: null,
        message:
          error instanceof Error
            ? error.message
            : "Không thể phân tích dữ liệu.",
      });
    } finally {
      setAiLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void Promise.resolve().then(() => loadReportData(false));
  }, [loadReportData]);

  const handleReportRangePresetChange = (nextPreset: ReportRangePreset) => {
    setRangePreset(nextPreset);
    const range = resolveReportRangePreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setAiInsights(null);
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
  const totalCOGS = summary?.totalCOGS ?? 0;
  const grossProfit = summary?.grossProfit ?? 0;
  const grossProfitMargin = summary?.grossProfitMargin ?? 0;
  const materialPurchaseCost = financialData?.materialPurchaseCost ?? 0;
  const cashRevenue =
    dashboard?.paymentMethods.find((item) => item.method === "cash")?.revenue ??
    shifts.reduce((sum, shift) => sum + Number(shift.totalSalesCash || 0), 0);
  const cashPercentage = totalRevenue ? Math.round((cashRevenue / totalRevenue) * 1000) / 10 : 0;
  const rangeLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  return (
    <AdminLayout
      title="Báo cáo"
      subtitle="Thống kê và phân tích dữ liệu bán hàng"
    >
      <div className="min-h-full space-y-5 bg-[#f8fafc] font-['Inter',sans-serif]">


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
              <ReportCard label="Tổng doanh thu" value={formatCurrency(totalRevenue)} helper={formatGrowth(financialData?.revenueGrowthPercent)} icon="wallet" tone="bg-orange-50 text-[#f97316]" trend={getGrowthTrend(financialData?.revenueGrowthPercent)} />
              <ReportCard label="Tổng đơn hàng" value={`${formatNumber(totalOrders)} đơn`} helper={formatGrowth(financialData?.ordersGrowthPercent)} icon="shopping_cart" tone="bg-green-50 text-green-500" trend={getGrowthTrend(financialData?.ordersGrowthPercent)} />
              <ReportCard label="Chi phí nhập nguyên liệu" value={formatCurrency(materialPurchaseCost)} helper={formatGrowth(financialData?.materialPurchaseCostGrowthPercent)} icon="inventory_2" tone="bg-purple-50 text-purple-500" trend={getGrowthTrend(financialData?.materialPurchaseCostGrowthPercent)} />
              <ReportCard label="Giá trị TB/đơn hàng (AOV)" value={formatCurrency(averageOrderValue)} helper={formatGrowth(financialData?.averageOrderValueGrowthPercent)} icon="receipt_long" tone="bg-blue-50 text-blue-500" trend={getGrowthTrend(financialData?.averageOrderValueGrowthPercent)} />
              <ReportCard label="Giá vốn và lợi nhuận" value={formatCurrency(grossProfit)} helper={`Giá vốn ${formatCurrency(totalCOGS)} · Biên ${grossProfitMargin.toFixed(1)}%`} icon="monitoring" tone="bg-amber-50 text-amber-500" trend="neutral" />
              <ReportCard label="Doanh thu tiền mặt" value={formatCurrency(cashRevenue)} helper={`${cashPercentage}% tổng doanh thu`} icon="payments" tone="bg-emerald-50 text-emerald-500" trend="neutral" />
            </section>

            <AiBusinessReport
              data={aiInsights}
              loading={aiLoading}
              onRefresh={() => void analyzeWithAi()}
              financialTrend={financialData?.trend ?? []}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
