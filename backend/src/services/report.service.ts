import {
  getRevenueAllEmployees,
  getRevenueByEmployeeId,
  getFinancialSummary,
  getFinancialTrend,
  getProductValuation,
  getRawMaterialValuation,
  getInventoryValuationByCategory,
  getEmployeePerformance,
  getRevenueByPeriod,
  getCustomerRetention,
} from "../repositories/report.repository";
import { saveAiReportLog } from "../repositories/ai-report-log.repository";
import { AI_REPORT_SYSTEM_PROMPT } from "../prompts/report-ai.prompt";
import { buildAiBusinessContext, type AiBusinessContext } from "./report-ai-context.service";
import { getTopProducts } from "../repositories/dashboard.repository";
import type { ComparisonPoint } from "../types/report.types";

export async function getEmployeeRevenueService(
  userRole: string,
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const role = userRole.trim().toUpperCase();

  if (role === "ADMIN" || role === "MANAGER") {
    return getRevenueAllEmployees(startDate, endDate);
  }

  return getRevenueByEmployeeId(userId, startDate, endDate);
}

export async function getAiInsightsContextService(startDate: string, endDate: string): Promise<AiBusinessContext> {
  return buildAiBusinessContext(startDate, endDate);
}

function extractJsonFromAiText(text: string) {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI không trả về JSON hợp lệ");
  }

  const jsonText = cleaned
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    const preview = jsonText.slice(0, 900);
    throw new Error(
      `AI trả JSON sai cú pháp: ${parseError instanceof Error ? parseError.message : String(parseError)} | Preview: ${preview}`
    );
  }
}

const fallbackAiData = {
  meta: {
    assistant_name: "QuickServe-AI",
    role: "Trợ lý phân tích kinh doanh",
    period: {
      from: "",
      to: "",
    },
    confidence: "thap",
    score: 0,
    status: "can_cai_thien",
    data_status: "thieu_du_lieu",
    confidence_note: "",
  },
  summary: {
    main_insight: "Chưa đủ dữ liệu để phân tích.",
    revenue_text: "Chưa đủ dữ liệu để phân tích.",
    orders_text: "Chưa đủ dữ liệu để phân tích.",
    best_selling_product: "Chưa đủ dữ liệu để phân tích.",
    best_shift: "Chưa đủ dữ liệu để phân tích.",
  },
  phan_tich_chuyen_sau: [],
  action_plan: [],
  warnings: [],
  chart_suggestions: [],
};

const AI_REPORT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    meta: {
      type: "OBJECT",
      properties: {
        assistant_name: { type: "STRING" },
        role: { type: "STRING" },
        period: {
          type: "OBJECT",
          properties: {
            from: { type: "STRING" },
            to: { type: "STRING" },
          },
        },
        confidence: { type: "STRING" },
        score: { type: "NUMBER" },
        confidence_note: { type: "STRING" },
        status: { type: "STRING" },
        data_status: { type: "STRING" },
      },
    },
    summary: {
      type: "OBJECT",
      properties: {
        main_insight: { type: "STRING" },
        revenue_text: { type: "STRING" },
        orders_text: { type: "STRING" },
        best_selling_product: { type: "STRING" },
        best_shift: { type: "STRING" },
      },
    },
    phan_tich_chuyen_sau: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          thu_tu: { type: "NUMBER" },
          loai: { type: "STRING" },
          tieu_de: { type: "STRING" },
          noi_dung: { type: "STRING" },
          muc_do: { type: "STRING" },
        },
      },
    },
    action_plan: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          priority: { type: "STRING" },
          action: { type: "STRING" },
          reason: { type: "STRING" },
          expected_result: { type: "STRING" },
        },
      },
    },
    warnings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING" },
          level: { type: "STRING" },
          message: { type: "STRING" },
          suggestion: { type: "STRING" },
        },
      },
    },
  },
} as const;

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatVnd(value: unknown) {
  return `${Math.round(toNumber(value)).toLocaleString("vi-VN")}đ`;
}

function formatPercent(value: unknown) {
  const numberValue = toNumber(value);
  const prefix = numberValue > 0 ? "+" : "";
  return `${prefix}${numberValue.toFixed(1)}%`;
}

function limitRecords<T>(items: T[] | undefined, limit: number) {
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

function buildAiPromptContext(context: AiBusinessContext) {
  return {
    period: context.period,
    businessMetrics: context.businessMetrics,
    dataQuality: context.dataQuality,
    advancedAnalysis: {
      overview: context.advancedAnalysis.overview,
      revenueTrend: context.advancedAnalysis.revenueTrend,
      changeReasons: limitRecords(context.advancedAnalysis.changeReasons, 4),
      productAnalysis: context.advancedAnalysis.productAnalysis,
      buyingBehavior: context.advancedAnalysis.buyingBehavior,
      anomalies: limitRecords(context.advancedAnalysis.anomalies, 4),
      limitations: limitRecords(context.advancedAnalysis.limitations, 4),
    },
    chartData: {
      dailyRevenue: limitRecords(context.trend, 7),
      categoryRevenue: limitRecords(context.categoryRevenue, 7),
      topProductsByRevenue: limitRecords(context.soldProducts, 5),
      paymentSummary: limitRecords(context.paymentSummary, 4),
    },
    operatingData: {
      hourlyRevenue: limitRecords(context.hourlyRevenue, 8),
      slowProducts: limitRecords(context.slowProducts, 5),
      lowStockItems: limitRecords(context.lowStockItems, 6),
      cancelledOrders: limitRecords(context.cancelledOrders, 5),
      shiftVarianceHistory: limitRecords(context.shiftVarianceHistory, 5),
    },
  };
}

function getRecordArray(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function normalizePaymentMethod(method: unknown) {
  const value = String(method || "").trim().toLowerCase();
  if (["cash", "cash_payment", "tien_mat", "tiền mặt"].includes(value)) return "cash";
  if (["qr", "qr_code", "bank_qr"].includes(value)) return "qr";
  if (["bank", "bank_transfer", "chuyen_khoan", "chuyển khoản"].includes(value)) return "bank_transfer";
  return value || "unknown";
}

function buildFallbackAdvancedAnalysis(context: AiBusinessContext) {
  const metrics = context.businessMetrics;
  const product = context.advancedAnalysis.productAnalysis;
  const trend = context.advancedAnalysis.revenueTrend;
  const behavior = context.advancedAnalysis.buyingBehavior;
  const lowStockItems = getRecordArray(context.lowStockItems);
  const slowProducts = getRecordArray(context.slowProducts);
  const cancelledOrders = getRecordArray(context.cancelledOrders);
  const growthText = metrics.revenueGrowthPercent === null
    ? "chưa có dữ liệu kỳ trước để so sánh"
    : `${metrics.revenueGrowthPercent >= 0 ? "tăng" : "giảm"} ${formatPercent(Math.abs(metrics.revenueGrowthPercent))} so với kỳ trước`;
  const highestText = trend.highestDay ? `cao nhất ${trend.highestDay.label} với ${formatVnd(trend.highestDay.revenue)}` : "chưa có ngày cao nhất";
  const lowestText = trend.lowestDay ? `thấp nhất ${trend.lowestDay.label} với ${formatVnd(trend.lowestDay.revenue)}` : "chưa có ngày thấp nhất";
  const topQuantity = product.topByQuantity;
  const topRevenue = product.topByRevenue;
  const slowest = product.slowestProduct;
  const cancelRate = metrics.totalOrders > 0 ? (cancelledOrders.length / metrics.totalOrders) * 100 : 0;

  return [
    {
      thu_tu: 1,
      loai: "xu_huong_doanh_thu",
      tieu_de: "Xu hướng doanh thu",
      noi_dung: `Doanh thu đạt ${formatVnd(metrics.totalRevenue)}, ${growthText}; ${highestText}, ${lowestText}.`,
      muc_do: metrics.revenueGrowthPercent !== null && metrics.revenueGrowthPercent < 0 ? "warning" : "positive",
    },
    {
      thu_tu: 2,
      loai: "nguyen_nhan_bien_dong",
      tieu_de: "Nguyên nhân tăng hoặc giảm",
      noi_dung: `Kỳ này có ${metrics.totalOrders} đơn, AOV ${formatVnd(metrics.averageOrderValue)}; biến động chủ yếu cần đối chiếu số đơn và AOV.`,
      muc_do: "neutral",
    },
    {
      thu_tu: 3,
      loai: "san_pham",
      tieu_de: "Phân tích sản phẩm",
      noi_dung: topQuantity || topRevenue
        ? `${topQuantity?.name || "Món bán nhiều"} bán nhiều nhất; ${topRevenue?.name || "món doanh thu cao"} tạo doanh thu cao nhất.`
        : "Chưa có dữ liệu sản phẩm bán ra để phân tích.",
      muc_do: "neutral",
    },
    {
      thu_tu: 4,
      loai: "hanh_vi_mua",
      tieu_de: "Khách hàng và hành vi mua",
      noi_dung: `AOV đạt ${formatVnd(metrics.averageOrderValue)}. ${behavior.paymentNote}`,
      muc_do: "neutral",
    },
    {
      thu_tu: 5,
      loai: "rui_ro_co_hoi",
      tieu_de: "Rủi ro và cơ hội",
      noi_dung: lowStockItems.length
        ? `${lowStockItems.length} mặt hàng tồn thấp; cơ hội là ghép combo từ món bán tốt để tăng giá trị hóa đơn.`
        : slowest
          ? `${slowest.name} bán chậm; có thể thử combo với món bán tốt để cải thiện doanh thu.`
          : cancelledOrders.length && cancelRate >= 2
            ? `Đơn hủy chiếm ${formatPercent(cancelRate)}; cần kiểm tra thao tác và lý do hủy trong ca cao điểm.`
            : "Chưa phát hiện rủi ro lớn; có thể tiếp tục tối ưu combo để tăng giá trị hóa đơn.",
      muc_do: lowStockItems.length || cancelRate >= 2 ? "warning" : "neutral",
    },
  ];
}

function buildFallbackActionPlan(context: AiBusinessContext) {
  const soldProducts = getRecordArray(context.soldProducts);
  const lowStockItems = getRecordArray(context.lowStockItems);
  const shiftVarianceHistory = getRecordArray(context.shiftVarianceHistory);
  const topProductName = soldProducts[0] ? String(soldProducts[0].name || "món bán chạy") : "món bán chạy";
  const lowStockName = lowStockItems[0] ? String(lowStockItems[0].name || "mặt hàng tồn thấp") : "mặt hàng tồn thấp";
  const hasVariance = shiftVarianceHistory.some((item) => Math.abs(toNumber(item.variance)) > 0);

  return [
    {
      priority: "cao",
      action: `Tạo combo bán kèm với ${topProductName}.`,
      reason: "Món bán chạy dễ kéo thêm món phụ.",
      expected_result: "Tăng AOV mỗi hóa đơn.",
    },
    {
      priority: "cao",
      action: `Chuẩn bị thêm ${topProductName} ở giờ cao điểm.`,
      reason: "Doanh thu theo giờ cho thấy nhu cầu tập trung.",
      expected_result: "Giảm hết món khi đông khách.",
    },
    {
      priority: lowStockItems.length ? "cao" : "trung_binh",
      action: lowStockItems.length ? `Bổ sung ${lowStockName} trước ca bán.` : "Kiểm tra tồn kho trước ca bán.",
      reason: lowStockItems.length ? "Có mặt hàng dưới ngưỡng tồn." : "Giữ nguồn hàng ổn định.",
      expected_result: "Hạn chế gián đoạn bán hàng.",
    },
    {
      priority: hasVariance ? "cao" : "trung_binh",
      action: "Đối chiếu tiền mặt khi chốt ca.",
      reason: hasVariance ? "Có ca phát sinh sai lệch." : "Cần kiểm soát dòng tiền.",
      expected_result: "Giảm sai lệch cuối ca.",
    },
    {
      priority: "thap",
      action: "Duy trì phân tích theo ngày và tuần.",
      reason: "Theo dõi đều giúp phát hiện sớm biến động.",
      expected_result: "Ra quyết định nhập hàng tốt hơn.",
    },
  ];
}

function buildWarnings(context: AiBusinessContext) {
  const metrics = context.businessMetrics;
  const lowStockItems = getRecordArray(context.lowStockItems);
  const cancelledOrders = getRecordArray(context.cancelledOrders);
  const shiftVarianceHistory = getRecordArray(context.shiftVarianceHistory);
  const cancelRate = metrics.totalOrders > 0 ? (cancelledOrders.length / metrics.totalOrders) * 100 : 0;
  const maxVariance = shiftVarianceHistory.reduce((max, item) => Math.max(max, Math.abs(toNumber(item.variance))), 0);
  const warnings = [];

  if (lowStockItems.length) {
    const names = lowStockItems.slice(0, 4).map((item) => String(item.name || "")).filter(Boolean).join(", ");
    warnings.push({
      type: "ton_kho",
      level: lowStockItems.length >= 5 ? "cao" : "trung_binh",
      message: `${lowStockItems.length} mặt hàng tồn thấp${names ? `: ${names}` : ""}.`,
      suggestion: "Kiểm tra tồn thực tế và nhập bổ sung trước ca bán tiếp theo.",
    });
  }

  if (cancelledOrders.length && cancelRate >= 2) {
    warnings.push({
      type: "doanh_thu",
      level: cancelRate >= 5 ? "cao" : "trung_binh",
      message: `${cancelledOrders.length} đơn bị hủy, chiếm ${formatPercent(cancelRate)} tổng đơn.`,
      suggestion: "Kiểm tra lý do hủy và khung giờ phát sinh hủy đơn.",
    });
  }

  if (maxVariance > 0) {
    warnings.push({
      type: "ca_lam",
      level: maxVariance >= 50000 ? "cao" : "trung_binh",
      message: `Sai lệch tiền mặt cao nhất ${formatVnd(maxVariance)} trong ca đã chốt.`,
      suggestion: "Đối chiếu tiền đầu ca, tiền mặt bán hàng và tiền thực tế.",
    });
  }

  return warnings.length
    ? warnings.slice(0, 4)
    : [
        {
          type: "khac",
          level: "thap",
          message: "Chưa phát hiện cảnh báo lớn trong khoảng dữ liệu đang xem.",
          suggestion: "Tiếp tục theo dõi doanh thu, tồn kho và sai lệch ca.",
        },
      ];
}

function buildSmartFallbackAiData(context: AiBusinessContext) {
  const metrics = context.businessMetrics;
  const soldProducts = getRecordArray(context.soldProducts);
  const paymentSummary = getRecordArray(context.paymentSummary);
  const lowStockItems = getRecordArray(context.lowStockItems);
  const shiftVarianceHistory = getRecordArray(context.shiftVarianceHistory);
  const categoryRevenue = getRecordArray(context.categoryRevenue);
  const topProduct = soldProducts[0];
  const topProductName = topProduct ? String(topProduct.name || "sản phẩm bán chạy") : "chưa có dữ liệu";
  const confidenceScore = Math.max(0, Math.min(toNumber(context.dataQuality.score), 100));
  const confidence = context.dataQuality.confidence;
  const hasOrders = metrics.totalOrders > 0;
  const growthText = metrics.revenueGrowthPercent === null
    ? "chưa có dữ liệu kỳ trước để so sánh"
    : `${metrics.revenueGrowthPercent >= 0 ? "tăng" : "giảm"} ${formatPercent(Math.abs(metrics.revenueGrowthPercent))} so với kỳ trước`;
  const revenueText = hasOrders
    ? `Báo cáo hệ thống ghi nhận ${formatVnd(metrics.totalRevenue)} từ ${metrics.totalOrders} đơn, ${growthText}.`
    : "Chưa có đơn hoàn thành trong khoảng báo cáo.";

  return {
    ...fallbackAiData,
    fallback: true,
    meta: {
      ...fallbackAiData.meta,
      period: {
        from: context.period.startDate,
        to: context.period.endDate,
      },
      confidence,
      score: confidenceScore,
      status: confidenceScore >= 85 ? "tot" : confidenceScore >= 65 ? "on_dinh" : "can_cai_thien",
      data_status: context.dataQuality.status,
      confidence_note: "AI chưa khả dụng. Đây là báo cáo dự phòng từ dữ liệu SQL của hệ thống.",
    },
    summary: {
      main_insight: revenueText,
      revenue_text: revenueText,
      orders_text: hasOrders
        ? `Tổng ${metrics.totalOrders} đơn, AOV ${formatVnd(metrics.averageOrderValue)}.`
        : "Chưa có đơn hàng hoàn thành trong khoảng lọc.",
      best_selling_product: topProduct
        ? `${topProductName}: ${toNumber(topProduct.soldQuantity)} lượt bán, doanh thu ${formatVnd(topProduct.revenue)}.`
        : "Chưa có dữ liệu sản phẩm bán ra.",
      best_shift: "Báo cáo dự phòng không kết luận ca hiệu quả nhất khi AI chưa khả dụng.",
    },
    phan_tich_chuyen_sau: buildFallbackAdvancedAnalysis(context),
    action_plan: buildFallbackActionPlan(context),
    warnings: buildWarnings(context),
    report_tables: {
      inventory_table: {
        title: "Bảng tồn kho cần chú ý",
        columns: ["Mặt hàng", "Loại", "Tồn hiện tại", "Ngưỡng", "Đơn vị"],
        rows: lowStockItems.map((item) => [
          String(item.name || ""),
          String(item.type || ""),
          toNumber(item.stockQuantity),
          toNumber(item.minStock),
          String(item.unit || ""),
        ]),
        validation_note: lowStockItems.length ? "Lấy từ raw_materials/products tồn thấp." : "Không có mặt hàng tồn thấp.",
      },
      sales_table: {
        title: "Bảng sản phẩm bán ra",
        columns: ["Sản phẩm", "Số lượng bán", "Doanh thu", "Tồn hiện tại", "Quản lý kho"],
        rows: soldProducts.map((item) => [
          String(item.name || ""),
          toNumber(item.soldQuantity),
          toNumber(item.revenue),
          toNumber(item.stockQuantity),
          String(item.isTrackedStock ? "Có" : "Không"),
        ]),
        validation_note: soldProducts.length ? "Lấy từ orders/order_details/products." : "Chưa có sản phẩm bán ra.",
      },
      categories_table: {
        title: "Bảng doanh thu theo danh mục",
        columns: ["Danh mục", "Doanh thu", "Số lượng bán", "Tỷ trọng"],
        rows: categoryRevenue.map((item) => [
          String(item.categoryName || item.name || ""),
          toNumber(item.revenue),
          toNumber(item.soldQuantity),
          `${toNumber(item.percentage)}%`,
        ]),
        validation_note: categoryRevenue.length
          ? "Lấy từ orders/order_details/products/categories."
          : "Chưa có doanh thu theo danh mục trong khoảng lọc.",
      },
      shift_table: {
        title: "Bảng ca làm và sai lệch tiền mặt",
        columns: ["Nhân viên", "Tiền đầu ca", "Tiền mặt bán hàng", "Tiền mặt thực tế", "Sai lệch"],
        rows: shiftVarianceHistory.map((item) => [
          String(item.userName || item.fullName || ""),
          toNumber(item.openingCash),
          toNumber(item.totalSalesCash),
          toNumber(item.actualClosingCash),
          toNumber(item.variance),
        ]),
        validation_note: shiftVarianceHistory.length ? "Lấy từ shifts đã đóng ca." : "Chưa có dữ liệu ca đã đóng.",
      },
      payment_table: {
        title: "Bảng phương thức thanh toán",
        columns: ["Phương thức", "Số đơn", "Số tiền"],
        rows: paymentSummary.map((item) => [
          normalizePaymentMethod(item.method || item.paymentMethod),
          toNumber(item.ordersCount),
          toNumber(item.amount),
        ]),
        validation_note: paymentSummary.length ? "Chỉ gồm phương thức có trong payments." : "Chưa có thanh toán paid.",
      },
    },
    chart_suggestions: [],
  };
}

function ensureAdvancedAnalysis(value: any, fallback: ReturnType<typeof buildFallbackAdvancedAnalysis>) {
  const input = Array.isArray(value) ? value : [];
  return fallback.map((fallbackItem) => {
    const matched = input.find((item) => item?.loai === fallbackItem.loai || Number(item?.thu_tu) === fallbackItem.thu_tu);
    return matched?.noi_dung
      ? { ...fallbackItem, ...matched, thu_tu: fallbackItem.thu_tu, loai: fallbackItem.loai, tieu_de: matched.tieu_de || fallbackItem.tieu_de }
      : fallbackItem;
  });
}

function ensureActionPlan(value: any, fallback: ReturnType<typeof buildFallbackActionPlan>) {
  const input = Array.isArray(value) ? value : [];
  return fallback.map((fallbackItem, index) => {
    const matched = input[index];
    return matched?.action
      ? {
          ...fallbackItem,
          ...matched,
          priority: ["cao", "trung_binh", "thap"].includes(String(matched.priority)) ? matched.priority : fallbackItem.priority,
        }
      : fallbackItem;
  });
}

function normalizeWarnings(value: any, fallback: ReturnType<typeof buildWarnings>) {
  const input = Array.isArray(value) ? value : [];
  const validWarnings = input
    .filter((item) => item?.message || item?.suggestion)
    .map((item) => ({
      type: String(item.type || "khac"),
      level: ["cao", "trung_binh", "thap"].includes(String(item.level)) ? item.level : "thap",
      message: String(item.message || "Chưa đủ dữ liệu để cảnh báo."),
      suggestion: String(item.suggestion || "Tiếp tục theo dõi dữ liệu vận hành."),
    }));
  return validWarnings.length ? validWarnings.slice(0, 4) : fallback;
}

function normalizeAiReportData(rawData: any, context: AiBusinessContext) {
  const fallbackData = buildSmartFallbackAiData(context);
  const input = rawData && typeof rawData === "object" ? rawData : {};
  const score = Math.max(0, Math.min(toNumber(context.dataQuality.score), 100));
  const confidence = context.dataQuality.confidence;

  return {
    ...fallbackData,
    fallback: false,
    meta: {
      ...fallbackData.meta,
      ...(input.meta || {}),
      period: fallbackData.meta.period,
      confidence,
      score,
      status: score >= 85 ? "tot" : score >= 65 ? "on_dinh" : "can_cai_thien",
      data_status: context.dataQuality.status,
      confidence_note: score < 65 ? context.dataQuality.note : "",
    },
    summary: {
      ...fallbackData.summary,
      ...(input.summary || {}),
    },
    phan_tich_chuyen_sau: ensureAdvancedAnalysis(input.phan_tich_chuyen_sau, fallbackData.phan_tich_chuyen_sau),
    action_plan: ensureActionPlan(input.action_plan, fallbackData.action_plan),
    warnings: normalizeWarnings(input.warnings, fallbackData.warnings),
    report_tables: fallbackData.report_tables,
    chart_suggestions: fallbackData.chart_suggestions || [],
  };
}
async function trySaveAiReportLog(input: Parameters<typeof saveAiReportLog>[0]) {
  try {
    await saveAiReportLog(input);
  } catch (logError) {
    console.error("Lỗi lưu AI report log:", logError);
  }
}

function buildGeminiGenerateContentUrl(apiUrl: string, model: string) {
  const baseUrl = apiUrl.replace(/\/$/, "");

  if (baseUrl.includes(":generateContent")) return baseUrl;
  if (baseUrl.endsWith(`/models/${model}`)) return `${baseUrl}:generateContent`;
  if (baseUrl.endsWith("/models")) return `${baseUrl}/${model}:generateContent`;

  return `${baseUrl}/models/${model}:generateContent`;
}

function extractTextFromGeminiResult(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "{}";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n") || "{}";
}
export async function getAiReportInsightsService(startDate: string, endDate: string, createdBy?: string | null) {
  const context: AiBusinessContext = await getAiInsightsContextService(startDate, endDate);

  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || "https://generativelanguage.googleapis.com/v1beta/models";
  const model = process.env.AI_MODEL || "gemini-3.1-flash-lite";
  const maxOutputTokens = Number(process.env.AI_MAX_TOKENS || 8192);

  if (!apiKey || !apiUrl) {
    const fallbackData = buildSmartFallbackAiData(context);

    await trySaveAiReportLog({
      startDate,
      endDate,
      context,
      aiResult: fallbackData,
      isFallback: true,
      errorMessage: "Chưa cấu hình API AI",
      createdBy,
    });

    return {
      success: false,
      fallback: true,
      data: fallbackData,
      message: "Chưa cấu hình API AI",
      context,
    };
  }

  try {
    const response = await fetch(buildGeminiGenerateContentUrl(apiUrl, model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: AI_REPORT_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(buildAiPromptContext(context)) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: AI_REPORT_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result: any = await response.json();
    const finishReason = result?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new Error(`Gemini dừng trước khi hoàn tất JSON: ${finishReason}`);
    }

    const text = extractTextFromGeminiResult(result);
    const aiData = normalizeAiReportData(extractJsonFromAiText(text), context);

    await trySaveAiReportLog({
      startDate,
      endDate,
      context,
      aiResult: aiData,
      isFallback: false,
      createdBy,
    });

    return {
      success: true,
      fallback: false,
      data: aiData,
      context,
    };
  } catch (error) {
    console.error("Lỗi gọi AI báo cáo:", error);
    const fallbackData = buildSmartFallbackAiData(context);

    await trySaveAiReportLog({
      startDate,
      endDate,
      context,
      aiResult: fallbackData,
      isFallback: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      createdBy,
    });

    return {
      success: false,
      fallback: true,
      data: fallbackData,
      message: "AI lỗi, hệ thống đang hiển thị báo cáo dự phòng từ dữ liệu hệ thống",
      context,
    };
  }
}
// 1. Service báo cáo tài chính
export async function getFinancialReportService(startDate?: string, endDate?: string) {
  const summary = await getFinancialSummary(startDate, endDate);
  const trend = await getFinancialTrend(startDate, endDate);
  const topProductsRaw = await getTopProducts(startDate, endDate);
  
  const topProducts = topProductsRaw.map((item) => ({
    name: String(item.name),
    soldQuantity: Number(item.soldQuantity ?? 0),
    revenue: Number(item.revenue ?? 0),
  }));

  return { summary, trend, topProducts };
}

// 2. Service báo cáo tồn kho và giá trị kho
export async function getInventoryValuationService() {
  const products = await getProductValuation();
  const rawMaterials = await getRawMaterialValuation();
  const categories = await getInventoryValuationByCategory();

  const totalProductsValue = products.reduce((sum, p) => sum + p.totalValue, 0);
  const totalRawValue = rawMaterials.reduce((sum, r) => sum + r.totalValue, 0);

  return {
    summary: {
      totalItems: products.length + rawMaterials.length,
      totalValue: totalProductsValue + totalRawValue,
      totalProductsValue,
      totalRawValue
    },
    categories,
    products,
    rawMaterials
  };
}

// 3. Service báo cáo hiệu suất nhân viên
export async function getEmployeePerformanceService(startDate?: string, endDate?: string) {
  return getEmployeePerformance(startDate, endDate);
}

// 4. Service báo cáo so sánh và tăng trưởng
export async function getComparisonReportService(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Số ngày thực tế

  // Tính toán thời gian chu kỳ trước đó
  const prevStartDate = new Date(start);
  prevStartDate.setDate(start.getDate() - diffDays);

  const prevEndDate = new Date(end);
  prevEndDate.setDate(end.getDate() - diffDays);

  const prevStartStr = prevStartDate.toISOString().split("T")[0];
  const prevEndStr = prevEndDate.toISOString().split("T")[0];

  // Lấy dữ liệu 2 kỳ
  const currentTrend = await getRevenueByPeriod(startDate, endDate);
  const previousTrend = await getRevenueByPeriod(prevStartStr, prevEndStr);

  const currentTotal = currentTrend.reduce((sum, item) => sum + item.revenue, 0);
  const previousTotal = previousTrend.reduce((sum, item) => sum + item.revenue, 0);

  const growthPercentage = previousTotal > 0 
    ? Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1)) 
    : 0;

  // Ghép ngày so sánh
  const trend: ComparisonPoint[] = [];
  for (let i = 0; i < diffDays; i++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + i);
    const curDateStr = curDate.toISOString().split("T")[0];

    const prevDate = new Date(prevStartDate);
    prevDate.setDate(prevStartDate.getDate() + i);
    const prevDateStr = prevDate.toISOString().split("T")[0];

    const curVal = currentTrend.find((r) => r.date === curDateStr)?.revenue || 0;
    const prevVal = previousTrend.find((r) => r.date === prevDateStr)?.revenue || 0;

    // Định dạng nhãn trục X: e.g. "Ngày 1 (20/06)" hoặc chỉ "Ngày X"
    const label = `Ngày ${i + 1}`;

    trend.push({
      label,
      currentPeriodValue: curVal,
      previousPeriodValue: prevVal
    });
  }

  return {
    currentTotal,
    previousTotal,
    growthPercentage,
    trend
  };
}

// 5. Service báo cáo khách hàng thân thiết
export async function getCustomerRetentionService(startDate?: string, endDate?: string) {
  return getCustomerRetention(startDate, endDate);
}



























