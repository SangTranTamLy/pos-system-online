import {
  getAiCancelledOrders,
  getAiCategoryRevenue,
  getAiHourlyRevenue,
  getAiPaymentSummary,
  getAiShiftVarianceHistory,
  getAiSlowProducts,
  getAiSoldProducts,
  getFinancialSummary,
  getFinancialTrend,
} from "../repositories/report.repository";
import { getLowStockItems } from "../repositories/dashboard.repository";

export type AiDataQuality = {
  score: number;
  confidence: "cao" | "trung_binh" | "thap";
  status: "du_du_lieu_co_ban" | "thieu_du_lieu";
  missing: string[];
  note: string;
};

export type AiAdvancedAnalysis = {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    revenueGrowthPercent: number | null;
    ordersGrowthPercent: number | null;
    summary: string;
  };
  revenueTrend: {
    direction: "increasing" | "decreasing" | "volatile" | "stable" | "insufficient_data";
    highestDay: { label: string; revenue: number } | null;
    lowestDay: { label: string; revenue: number } | null;
    last7Revenue: number;
    last30Revenue: number;
    note: string;
  };
  changeReasons: Array<{
    title: string;
    description: string;
    recommendation: string;
    level: "low" | "medium" | "high";
  }>;
  productAnalysis: {
    topByQuantity: { name: string; soldQuantity: number; revenue: number } | null;
    topByRevenue: { name: string; soldQuantity: number; revenue: number } | null;
    slowestProduct: { name: string; soldQuantity: number; stockQuantity: number | null } | null;
    note: string;
  };
  buyingBehavior: {
    paymentNote: string;
    dominantPaymentMethod: string | null;
    cashAmount: number;
    qrAmount: number;
    note: string;
  };
  anomalies: Array<{
    type: "revenue" | "cancelled_orders" | "cash_variance" | "inventory" | "product" | "data";
    severity: "low" | "medium" | "high";
    title: string;
    description: string;
    recommendation: string;
  }>;
  limitations: string[];
};

export type AiBusinessContext = {
  period: {
    startDate: string;
    endDate: string;
    weekday: string;
  };
  businessMetrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    grossProfit: number;
    grossProfitMargin: number;
    previousTotalRevenue: number;
    previousTotalOrders: number;
    revenueGrowthPercent: number | null;
    ordersGrowthPercent: number | null;
  };
  previousPeriod: {
    startDate: string;
    endDate: string;
    summary: Awaited<ReturnType<typeof getFinancialSummary>>;
    trend: Awaited<ReturnType<typeof getFinancialTrend>>;
  };
  dataQuality: AiDataQuality;
  trend: Awaited<ReturnType<typeof getFinancialTrend>>;
  hourlyRevenue: Awaited<ReturnType<typeof getAiHourlyRevenue>>;
  categoryRevenue: Awaited<ReturnType<typeof getAiCategoryRevenue>>;
  soldProducts: Awaited<ReturnType<typeof getAiSoldProducts>>;
  slowProducts: Awaited<ReturnType<typeof getAiSlowProducts>>;
  paymentSummary: Awaited<ReturnType<typeof getAiPaymentSummary>>;
  cancelledOrders: Awaited<ReturnType<typeof getAiCancelledOrders>>;
  lowStockItems: Awaited<ReturnType<typeof getLowStockItems>>;
  shiftVarianceHistory: Awaited<ReturnType<typeof getAiShiftVarianceHistory>>;
  advancedAnalysis: AiAdvancedAnalysis;
};

const AI_ANALYSIS_THRESHOLDS = {
  revenueDropMediumPercent: 20,
  revenueDropHighPercent: 40,
  cancelRateMediumPercent: 5,
  cancelRateHighPercent: 10,
  cashVarianceMedium: 10000,
  cashVarianceHigh: 50000,
};

function getVietnameseWeekday(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(date);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviousPeriod(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffDays = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  const previousEnd = new Date(start);
  previousEnd.setDate(start.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - diffDays + 1);

  return {
    startDate: formatDateInput(previousStart),
    endDate: formatDateInput(previousEnd),
  };
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatVnd(value: unknown) {
  return `${Math.round(toNumber(value)).toLocaleString("vi-VN")}đ`;
}

function getGrowthPercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function formatPercent(value: number | null) {
  if (value === null) return "chưa có dữ liệu kỳ trước";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function getTrendDirection(points: Array<{ revenue: number }>): AiAdvancedAnalysis["revenueTrend"]["direction"] {
  if (points.length < 3) return "insufficient_data";

  const revenues = points.map((point) => point.revenue);
  const first = revenues[0];
  const last = revenues[revenues.length - 1];
  const average = revenues.reduce((sum, value) => sum + value, 0) / revenues.length;
  const max = Math.max(...revenues);
  const min = Math.min(...revenues);

  if (average > 0 && (max - min) / average > 0.75) return "volatile";
  if (last > first * 1.12) return "increasing";
  if (last < first * 0.88) return "decreasing";
  return "stable";
}

function buildDataQuality(input: {
  totalOrders: number;
  previousTotalOrders: number;
  trendCount: number;
  hourlyRevenueCount: number;
  soldProductsCount: number;
  paymentSummaryCount: number;
  lowStockItemsCount: number;
  shiftVarianceCount: number;
  categoryRevenueCount: number;
}): AiDataQuality {
  let score = 100;
  const missing: string[] = [];

  if (input.totalOrders <= 0) {
    score -= 35;
    missing.push("orders");
  }

  if (input.previousTotalOrders <= 0) {
    score -= 12;
    missing.push("previous_period");
  }

  if (input.trendCount <= 0) {
    score -= 14;
    missing.push("daily_revenue_trend");
  }

  if (input.hourlyRevenueCount <= 0) {
    score -= 8;
    missing.push("hourly_revenue");
  }

  if (input.soldProductsCount <= 0) {
    score -= 14;
    missing.push("sold_products");
  }

  if (input.categoryRevenueCount <= 0) {
    score -= 8;
    missing.push("category_revenue");
  }

  if (input.paymentSummaryCount <= 0) {
    score -= 8;
    missing.push("payment_summary");
  }

  if (input.lowStockItemsCount <= 0) {
    score -= 3;
    missing.push("inventory_warning");
  }

  if (input.shiftVarianceCount <= 0) {
    score -= 3;
    missing.push("shift_data");
  }

  const normalizedScore = Math.max(0, Math.min(score, 100));
  const confidence =
    normalizedScore >= 85 ? "cao" : normalizedScore >= 65 ? "trung_binh" : "thap";

  return {
    score: normalizedScore,
    confidence,
    status: input.totalOrders > 0 && input.soldProductsCount > 0 ? "du_du_lieu_co_ban" : "thieu_du_lieu",
    missing,
    note:
      normalizedScore < 65
        ? "Đây là nhận định tham khảo do dữ liệu chưa đầy đủ."
        : "Dữ liệu đủ để phân tích ở mức cơ bản.",
  };
}

function buildAdvancedAnalysis(input: {
  summary: Awaited<ReturnType<typeof getFinancialSummary>>;
  previousSummary: Awaited<ReturnType<typeof getFinancialSummary>>;
  trend: Awaited<ReturnType<typeof getFinancialTrend>>;
  hourlyRevenue: Awaited<ReturnType<typeof getAiHourlyRevenue>>;
  soldProducts: Awaited<ReturnType<typeof getAiSoldProducts>>;
  slowProducts: Awaited<ReturnType<typeof getAiSlowProducts>>;
  paymentSummary: Awaited<ReturnType<typeof getAiPaymentSummary>>;
  cancelledOrders: Awaited<ReturnType<typeof getAiCancelledOrders>>;
  lowStockItems: Awaited<ReturnType<typeof getLowStockItems>>;
  shiftVarianceHistory: Awaited<ReturnType<typeof getAiShiftVarianceHistory>>;
  revenueGrowthPercent: number | null;
  ordersGrowthPercent: number | null;
}): AiAdvancedAnalysis {
  const {
    summary,
    previousSummary,
    trend,
    soldProducts,
    slowProducts,
    paymentSummary,
    cancelledOrders,
    lowStockItems,
    shiftVarianceHistory,
    revenueGrowthPercent,
    ordersGrowthPercent,
  } = input;

  const sortedTrend = trend.map((point) => ({
    label: String(point.label || ""),
    revenue: toNumber(point.revenue),
  }));
  const highestDay = sortedTrend.length ? [...sortedTrend].sort((a, b) => b.revenue - a.revenue)[0] : null;
  const lowestDay = sortedTrend.length ? [...sortedTrend].sort((a, b) => a.revenue - b.revenue)[0] : null;
  const last7Revenue = sortedTrend.slice(-7).reduce((sum, point) => sum + point.revenue, 0);
  const last30Revenue = sortedTrend.slice(-30).reduce((sum, point) => sum + point.revenue, 0);
  const direction = getTrendDirection(sortedTrend);

  const topByQuantity = soldProducts.length
    ? [...soldProducts].sort((a, b) => toNumber(b.soldQuantity) - toNumber(a.soldQuantity))[0]
    : null;
  const topByRevenue = soldProducts.length
    ? [...soldProducts].sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue))[0]
    : null;
  const slowestProduct = slowProducts.length ? slowProducts[0] : null;

  const cashPayment = paymentSummary.find((item) => String(item.method).toLowerCase() === "cash");
  const qrPayment = paymentSummary.find((item) => String(item.method).toLowerCase() === "qr");
  const cashAmount = toNumber(cashPayment?.amount);
  const qrAmount = toNumber(qrPayment?.amount);
  const dominantPaymentMethod =
    cashAmount === 0 && qrAmount === 0 ? null : cashAmount >= qrAmount ? "cash" : "qr";

  const changeReasons: AiAdvancedAnalysis["changeReasons"] = [];
  if (summary.totalOrders > 0 && previousSummary.totalOrders > 0 && revenueGrowthPercent !== null) {
    const currentAov = summary.averageOrderValue;
    const previousAov = previousSummary.averageOrderValue;
    const aovGrowthPercent = previousAov > 0 ? ((currentAov - previousAov) / previousAov) * 100 : null;
    const orderChangedMore =
      ordersGrowthPercent !== null &&
      aovGrowthPercent !== null &&
      Math.abs(ordersGrowthPercent) >= Math.abs(aovGrowthPercent);

    changeReasons.push({
      title: revenueGrowthPercent >= 0 ? "Doanh thu tăng so với kỳ trước" : "Doanh thu giảm so với kỳ trước",
      description: orderChangedMore
        ? `Biến động doanh thu chủ yếu đi theo số đơn: kỳ này ${summary.totalOrders} đơn, kỳ trước ${previousSummary.totalOrders} đơn. AOV hiện là ${formatVnd(currentAov)}.`
        : `Biến động doanh thu chủ yếu nằm ở giá trị trung bình mỗi đơn: AOV hiện là ${formatVnd(currentAov)}, kỳ trước là ${formatVnd(previousAov)}.`,
      recommendation:
        revenueGrowthPercent >= 0
          ? "Giữ nhóm món đang kéo doanh thu và thử bán kèm để tăng thêm AOV."
          : "Kiểm tra lại số đơn, AOV và món bán chạy trong ca thấp để xác định điểm rơi doanh thu.",
      level:
        revenueGrowthPercent <= -AI_ANALYSIS_THRESHOLDS.revenueDropHighPercent
          ? "high"
          : Math.abs(revenueGrowthPercent) >= AI_ANALYSIS_THRESHOLDS.revenueDropMediumPercent
            ? "medium"
            : "low",
    });
  }

  if (topByQuantity && topByRevenue) {
    changeReasons.push({
      title:
        topByQuantity.productId === topByRevenue.productId
          ? "Một món đang dẫn cả số lượng và doanh thu"
          : "Món bán nhiều và món tạo doanh thu cao không giống nhau",
      description:
        topByQuantity.productId === topByRevenue.productId
          ? `${topByQuantity.name} bán ${topByQuantity.soldQuantity} lượt và tạo ${formatVnd(topByQuantity.revenue)} doanh thu.`
          : `${topByQuantity.name} bán nhiều nhất (${topByQuantity.soldQuantity} lượt), trong khi ${topByRevenue.name} tạo doanh thu cao nhất (${formatVnd(topByRevenue.revenue)}).`,
      recommendation: "Khi làm combo, ưu tiên ghép món bán nhiều với món có doanh thu tốt để tăng giá trị hóa đơn.",
      level: "medium",
    });
  }

  const anomalies: AiAdvancedAnalysis["anomalies"] = [];
  if (revenueGrowthPercent !== null && revenueGrowthPercent <= -AI_ANALYSIS_THRESHOLDS.revenueDropMediumPercent) {
    anomalies.push({
      type: "revenue",
      severity: revenueGrowthPercent <= -AI_ANALYSIS_THRESHOLDS.revenueDropHighPercent ? "high" : "medium",
      title: "Doanh thu giảm đáng chú ý",
      description: `Doanh thu kỳ này ${formatPercent(revenueGrowthPercent)} so với kỳ trước.`,
      recommendation: "So lại số đơn, AOV và khung giờ bán thấp để biết giảm do ít khách hay do khách mua ít hơn.",
    });
  }

  const cancelRate = summary.totalOrders > 0 ? (cancelledOrders.length / summary.totalOrders) * 100 : 0;
  if (cancelRate >= AI_ANALYSIS_THRESHOLDS.cancelRateMediumPercent) {
    anomalies.push({
      type: "cancelled_orders",
      severity: cancelRate >= AI_ANALYSIS_THRESHOLDS.cancelRateHighPercent ? "high" : "medium",
      title: "Tỷ lệ đơn hủy cao",
      description: `${cancelledOrders.length} đơn bị hủy, tương đương ${cancelRate.toFixed(1)}% tổng số đơn trong kỳ.`,
      recommendation: "Kiểm tra lý do hủy đơn, khung giờ hủy và thao tác vận hành để loại trừ lỗi.",
    });
  }

  const varianceShift = [...shiftVarianceHistory].sort(
    (a, b) => Math.abs(toNumber(b.variance)) - Math.abs(toNumber(a.variance))
  )[0];
  if (varianceShift && Math.abs(toNumber(varianceShift.variance)) >= AI_ANALYSIS_THRESHOLDS.cashVarianceMedium) {
    anomalies.push({
      type: "cash_variance",
      severity:
        Math.abs(toNumber(varianceShift.variance)) >= AI_ANALYSIS_THRESHOLDS.cashVarianceHigh ? "high" : "medium",
      title: "Có ca lệch tiền mặt",
      description: `Ca của ${varianceShift.userName || "nhân viên"} lệch ${formatVnd(varianceShift.variance)} khi chốt ca.`,
      recommendation: "Đối chiếu tiền đầu ca, tiền mặt bán hàng và tiền thực tế trước khi xác nhận chốt ca.",
    });
  }

  if (lowStockItems.length > 0) {
    anomalies.push({
      type: "inventory",
      severity: lowStockItems.length >= 5 ? "high" : "medium",
      title: "Tồn kho thấp",
      description: `${lowStockItems.length} mặt hàng đang dưới ngưỡng tồn kho, nổi bật là ${lowStockItems[0].name}.`,
      recommendation: "Bổ sung hàng trước ca bán tiếp theo, nhất là nếu mặt hàng liên quan nhóm đang bán tốt.",
    });
  }

  return {
    overview: {
      totalRevenue: summary.totalRevenue,
      totalOrders: summary.totalOrders,
      averageOrderValue: summary.averageOrderValue,
      revenueGrowthPercent,
      ordersGrowthPercent,
      summary:
        revenueGrowthPercent === null
          ? `Doanh thu kỳ này đạt ${formatVnd(summary.totalRevenue)} từ ${summary.totalOrders} đơn. Chưa đủ dữ liệu kỳ trước để kết luận tăng giảm.`
          : `Doanh thu kỳ này đạt ${formatVnd(summary.totalRevenue)}, ${revenueGrowthPercent >= 0 ? "tăng" : "giảm"} ${formatPercent(Math.abs(revenueGrowthPercent))} so với kỳ trước.`,
    },
    revenueTrend: {
      direction,
      highestDay,
      lowestDay,
      last7Revenue,
      last30Revenue,
      note:
        direction === "volatile"
          ? "Doanh thu đang biến động mạnh giữa các ngày, cần xem thêm theo ca và món bán chính."
          : direction === "increasing"
            ? "Doanh thu có xu hướng tăng trong các điểm dữ liệu gần đây."
            : direction === "decreasing"
              ? "Doanh thu có xu hướng giảm trong các điểm dữ liệu gần đây."
              : direction === "stable"
                ? "Doanh thu tương đối ổn định trong khoảng dữ liệu đang xem."
                : "Chưa đủ điểm dữ liệu để đọc xu hướng doanh thu.",
    },
    changeReasons,
    productAnalysis: {
      topByQuantity: topByQuantity
        ? { name: topByQuantity.name, soldQuantity: topByQuantity.soldQuantity, revenue: topByQuantity.revenue }
        : null,
      topByRevenue: topByRevenue
        ? { name: topByRevenue.name, soldQuantity: topByRevenue.soldQuantity, revenue: topByRevenue.revenue }
        : null,
      slowestProduct: slowestProduct
        ? { name: slowestProduct.name, soldQuantity: slowestProduct.soldQuantity, stockQuantity: slowestProduct.stockQuantity }
        : null,
      note: topByQuantity
        ? `${topByQuantity.name} là món bán nhiều nhất trong kỳ.`
        : "Chưa có dữ liệu sản phẩm bán ra để phân tích.",
    },
    buyingBehavior: {
      paymentNote:
        dominantPaymentMethod === "cash"
          ? `Tiền mặt đang chiếm tỷ trọng cao hơn QR (${formatVnd(cashAmount)} so với ${formatVnd(qrAmount)}).`
          : dominantPaymentMethod === "qr"
            ? `QR đang chiếm tỷ trọng cao hơn tiền mặt (${formatVnd(qrAmount)} so với ${formatVnd(cashAmount)}).`
            : "Chưa có dữ liệu thanh toán paid để phân tích hành vi thanh toán.",
      dominantPaymentMethod,
      cashAmount,
      qrAmount,
      note: "Hệ thống hiện có dữ liệu phương thức thanh toán; chưa đủ dữ liệu combo mua kèm nếu không truy vấn theo cặp món.",
    },
    anomalies,
    limitations: [
      "Chưa phân tích được combo mua kèm nếu chưa có truy vấn theo cặp sản phẩm trong order_details.",
      "Chưa phân tích khách quay lại nếu đơn hàng không gắn customer_id.",
    ],
  };
}

export async function buildAiBusinessContext(startDate: string, endDate: string): Promise<AiBusinessContext> {
  const previousPeriodRange = getPreviousPeriod(startDate, endDate);
  const [
    summary,
    previousSummary,
    trend,
    previousTrend,
    hourlyRevenue,
    categoryRevenue,
    soldProducts,
    slowProducts,
    paymentSummary,
    cancelledOrders,
    lowStockItems,
    shiftVarianceHistory,
  ] = await Promise.all([
    getFinancialSummary(startDate, endDate),
    getFinancialSummary(previousPeriodRange.startDate, previousPeriodRange.endDate),
    getFinancialTrend(startDate, endDate),
    getFinancialTrend(previousPeriodRange.startDate, previousPeriodRange.endDate),
    getAiHourlyRevenue(startDate, endDate),
    getAiCategoryRevenue(startDate, endDate),
    getAiSoldProducts(startDate, endDate),
    getAiSlowProducts(startDate, endDate),
    getAiPaymentSummary(startDate, endDate),
    getAiCancelledOrders(startDate, endDate),
    getLowStockItems(),
    getAiShiftVarianceHistory(startDate, endDate),
  ]);

  const revenueGrowthPercent = getGrowthPercent(summary.totalRevenue, previousSummary.totalRevenue);
  const ordersGrowthPercent = getGrowthPercent(summary.totalOrders, previousSummary.totalOrders);

  const dataQuality = buildDataQuality({
    totalOrders: summary.totalOrders,
    previousTotalOrders: previousSummary.totalOrders,
    trendCount: trend.length,
    hourlyRevenueCount: hourlyRevenue.length,
    categoryRevenueCount: categoryRevenue.length,
    soldProductsCount: soldProducts.length,
    paymentSummaryCount: paymentSummary.length,
    lowStockItemsCount: lowStockItems.length,
    shiftVarianceCount: shiftVarianceHistory.length,
  });

  const advancedAnalysis = buildAdvancedAnalysis({
    summary,
    previousSummary,
    trend,
    hourlyRevenue,
    soldProducts,
    slowProducts,
    paymentSummary,
    cancelledOrders,
    lowStockItems,
    shiftVarianceHistory,
    revenueGrowthPercent,
    ordersGrowthPercent,
  });

  return {
    period: {
      startDate,
      endDate,
      weekday: getVietnameseWeekday(startDate),
    },
    businessMetrics: {
      totalRevenue: summary.totalRevenue,
      totalOrders: summary.totalOrders,
      averageOrderValue: summary.averageOrderValue,
      grossProfit: summary.grossProfit,
      grossProfitMargin: summary.grossProfitMargin,
      previousTotalRevenue: previousSummary.totalRevenue,
      previousTotalOrders: previousSummary.totalOrders,
      revenueGrowthPercent,
      ordersGrowthPercent,
    },
    previousPeriod: {
      startDate: previousPeriodRange.startDate,
      endDate: previousPeriodRange.endDate,
      summary: previousSummary,
      trend: previousTrend,
    },
    dataQuality,
    trend,
    hourlyRevenue,
    categoryRevenue,
    soldProducts,
    slowProducts,
    paymentSummary,
    cancelledOrders,
    lowStockItems,
    shiftVarianceHistory,
    advancedAnalysis,
  };
}
