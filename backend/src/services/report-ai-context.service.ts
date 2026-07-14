import {
  getAiCancelledOrders,
  getAiCategoryRevenue,
  getAiHourlyRevenue,
  getAiPaymentSummary,
  getAiSlowProducts,
  getAiSoldProducts,
  getFinancialSummary,
  getFinancialTrend,
} from "../repositories/report.repository";
import { getLowStockItems } from "../repositories/dashboard.repository";
import type { FinancialTrendPoint } from "../types/report.types";

export type AiDataQuality = {
  coverageScore: number;
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
    type: "revenue" | "cancelled_orders" | "inventory" | "product" | "data";
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
  previousCancelledOrders: Awaited<ReturnType<typeof getAiCancelledOrders>>;
  lowStockItems: Awaited<ReturnType<typeof getLowStockItems>>;
  advancedAnalysis: AiAdvancedAnalysis;
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

function fillMissingRevenueDays(
  startDate: string,
  endDate: string,
  points: FinancialTrendPoint[]
): FinancialTrendPoint[] {
  const pointsByDate = new Map(points.map((item) => [item.date, item]));
  const result: FinancialTrendPoint[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    const date = formatDateInput(current);

    result.push(
      pointsByDate.get(date) || {
        date,
        label: new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }).format(current),
        revenue: 0,
        cogs: 0,
        profit: 0,
      }
    );

    current.setDate(current.getDate() + 1);
  }

  return result;
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

async function getInventoryContext() {
  try {
    return {
      available: true,
      items: await getLowStockItems(),
    };
  } catch (error) {
    console.warn("Không thể lấy dữ liệu tồn kho cho AI context:", error);
    return {
      available: false,
      items: [] as Awaited<ReturnType<typeof getLowStockItems>>,
    };
  }
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
  inventoryQueryAvailable: boolean;
  categoryRevenueCount: number;
}): AiDataQuality {
  let score = 0;
  const missing: string[] = [];

  if (input.totalOrders >= 100) score += 20;
  else if (input.totalOrders >= 30) score += 15;
  else if (input.totalOrders > 0) score += 8;
  else missing.push("orders");

  if (input.previousTotalOrders >= 30) score += 12;
  else if (input.previousTotalOrders > 0) score += 7;
  else missing.push("previous_period");

  if (input.trendCount >= 14) score += 14;
  else if (input.trendCount >= 7) score += 11;
  else if (input.trendCount >= 3) score += 6;
  else missing.push("daily_revenue_trend");

  if (input.hourlyRevenueCount >= 8) score += 10;
  else if (input.hourlyRevenueCount >= 3) score += 6;
  else if (input.hourlyRevenueCount > 0) score += 3;
  else missing.push("hourly_revenue");

  if (input.soldProductsCount >= 8) score += 14;
  else if (input.soldProductsCount >= 3) score += 10;
  else if (input.soldProductsCount > 0) score += 5;
  else missing.push("sold_products");

  if (input.categoryRevenueCount >= 3) score += 10;
  else if (input.categoryRevenueCount > 0) score += 5;
  else missing.push("category_revenue");

  if (input.paymentSummaryCount >= 2) score += 8;
  else if (input.paymentSummaryCount > 0) score += 4;
  else missing.push("payment_summary");

  if (input.inventoryQueryAvailable) score += 6;
  else missing.push("inventory_data");

  const normalizedScore = Math.max(0, Math.min(Math.round(score), 95));
  const confidence =
    normalizedScore >= 85 ? "cao" : normalizedScore >= 65 ? "trung_binh" : "thap";

  return {
    coverageScore: normalizedScore,
    confidence,
    status: input.totalOrders > 0 && input.soldProductsCount > 0 ? "du_du_lieu_co_ban" : "thieu_du_lieu",
    missing,
    note:
      normalizedScore < 70
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
  previousCancelledOrders: Awaited<ReturnType<typeof getAiCancelledOrders>>;
  lowStockItems: Awaited<ReturnType<typeof getLowStockItems>>;
  revenueGrowthPercent: number | null;
  ordersGrowthPercent: number | null;
}): AiAdvancedAnalysis {
  const trendPoints = input.trend.map((point) => ({
    label: String(point.label || ""),
    revenue: toNumber(point.revenue),
  }));
  const sortedTrend = [...trendPoints].sort((a, b) => b.revenue - a.revenue);
  const highestDay = sortedTrend[0] || null;
  const lowestDay = [...trendPoints].sort((a, b) => a.revenue - b.revenue)[0] || null;
  const last7Revenue = trendPoints.slice(-7).reduce((sum, point) => sum + point.revenue, 0);
  const last30Revenue = trendPoints.slice(-30).reduce((sum, point) => sum + point.revenue, 0);
  const direction = getTrendDirection(trendPoints);

  const soldProducts = input.soldProducts.map((item) => ({
    name: String(item.name || ""),
    soldQuantity: toNumber(item.soldQuantity),
    revenue: toNumber(item.revenue),
  }));
  const topByQuantity = [...soldProducts].sort((a, b) => b.soldQuantity - a.soldQuantity)[0] || null;
  const topByRevenue = [...soldProducts].sort((a, b) => b.revenue - a.revenue)[0] || null;
  const slowestRaw = input.slowProducts[0];
  const slowestProduct = slowestRaw
    ? {
        name: String(slowestRaw.name || ""),
        soldQuantity: toNumber(slowestRaw.soldQuantity),
        stockQuantity: slowestRaw.stockQuantity === null ? null : toNumber(slowestRaw.stockQuantity),
      }
    : null;

  const cashPayment = input.paymentSummary.find((item) => String(item.method || "").toLowerCase() === "cash");
  const qrPayment = input.paymentSummary.find((item) => String(item.method || "").toLowerCase() === "qr");
  const cashAmount = toNumber(cashPayment?.amount);
  const qrAmount = toNumber(qrPayment?.amount);
  const dominantPaymentMethod = cashAmount > qrAmount ? "Tiền mặt" : qrAmount > cashAmount ? "QR" : null;

  const changeReasons: AiAdvancedAnalysis["changeReasons"] = [];
  if (input.revenueGrowthPercent !== null) {
    changeReasons.push({
      title: input.revenueGrowthPercent >= 0 ? "Doanh thu tăng" : "Doanh thu giảm",
      description: `Doanh thu ${formatPercent(input.revenueGrowthPercent)} so với kỳ trước, số đơn ${formatPercent(input.ordersGrowthPercent)}.`,
      recommendation: input.revenueGrowthPercent >= 0 ? "Giữ nhóm sản phẩm và khung giờ đang kéo doanh thu." : "Kiểm tra số đơn, AOV và món bán chậm trong kỳ.",
      level: Math.abs(input.revenueGrowthPercent) >= 20 ? "high" : "medium",
    });
  } else {
    changeReasons.push({
      title: "Chưa có kỳ trước để so sánh",
      description: "Không đủ dữ liệu kỳ trước để kết luận tăng hoặc giảm.",
      recommendation: "Tiếp tục ghi nhận dữ liệu để so sánh ở kỳ tiếp theo.",
      level: "low",
    });
  }

  const anomalies: AiAdvancedAnalysis["anomalies"] = [];
  if (input.revenueGrowthPercent !== null && input.revenueGrowthPercent <= -20) {
    anomalies.push({
      type: "revenue",
      severity: input.revenueGrowthPercent <= -40 ? "high" : "medium",
      title: "Doanh thu giảm mạnh",
      description: `Doanh thu giảm ${Math.abs(input.revenueGrowthPercent).toFixed(1)}% so với kỳ trước.`,
      recommendation: "Kiểm tra ca bán thấp, món chủ lực và tình trạng tồn kho.",
    });
  }

  const cancelRate = input.summary.totalOrders > 0 ? (input.cancelledOrders.length / input.summary.totalOrders) * 100 : 0;
  if (cancelRate >= 2) {
    anomalies.push({
      type: "cancelled_orders",
      severity: cancelRate >= 5 ? "high" : "medium",
      title: "Tỷ lệ đơn hủy cần theo dõi",
      description: `${input.cancelledOrders.length} đơn bị hủy, tương đương ${cancelRate.toFixed(1)}% tổng đơn.`,
      recommendation: "Kiểm tra lý do hủy đơn và thao tác POS trong các khung giờ phát sinh.",
    });
  }

  if (input.lowStockItems.length > 0) {
    const names = input.lowStockItems.slice(0, 3).map((item) => item.name).join(", ");
    anomalies.push({
      type: "inventory",
      severity: input.lowStockItems.length >= 5 ? "high" : "medium",
      title: "Tồn kho thấp",
      description: `${input.lowStockItems.length} mặt hàng dưới ngưỡng tồn kho, nổi bật: ${names}.`,
      recommendation: "Bổ sung nguyên liệu trước ca bán tiếp theo để tránh mất đơn.",
    });
  }

  const topRevenueShare = input.summary.totalRevenue > 0 && topByRevenue ? (topByRevenue.revenue / input.summary.totalRevenue) * 100 : 0;
  if (slowestProduct || topRevenueShare >= 45) {
    anomalies.push({
      type: "product",
      severity: topRevenueShare >= 60 ? "high" : "medium",
      title: topRevenueShare >= 45 ? "Doanh thu phụ thuộc món bán chạy" : "Có món bán chậm cần theo dõi",
      description: topRevenueShare >= 45 && topByRevenue
        ? `${topByRevenue.name} đóng góp ${topRevenueShare.toFixed(1)}% doanh thu trong kỳ.`
        : `${slowestProduct?.name || "Một số món"} bán chậm trong khoảng lọc.`,
      recommendation: "Theo dõi tồn kho, vị trí hiển thị và thử combo với món bán tốt.",
    });
  }

  const limitations: string[] = [];
  if (!input.paymentSummary.length) limitations.push("Thiếu dữ liệu thanh toán.");
  if (!input.cancelledOrders.length) limitations.push("Không ghi nhận đơn hủy trong khoảng lọc.");

  return {
    overview: {
      totalRevenue: input.summary.totalRevenue,
      totalOrders: input.summary.totalOrders,
      averageOrderValue: input.summary.averageOrderValue,
      revenueGrowthPercent: input.revenueGrowthPercent,
      ordersGrowthPercent: input.ordersGrowthPercent,
      summary: `Doanh thu kỳ này đạt ${formatVnd(input.summary.totalRevenue)}, ${formatPercent(input.revenueGrowthPercent)} so với kỳ trước.`,
    },
    revenueTrend: {
      direction,
      highestDay,
      lowestDay,
      last7Revenue,
      last30Revenue,
      note: highestDay && lowestDay
        ? `Ngày cao nhất là ${highestDay.label} với ${formatVnd(highestDay.revenue)}, thấp nhất là ${lowestDay.label} với ${formatVnd(lowestDay.revenue)}.`
        : "Chưa đủ dữ liệu doanh thu theo ngày.",
    },
    changeReasons,
    productAnalysis: {
      topByQuantity,
      topByRevenue,
      slowestProduct,
      note: topByQuantity && topByRevenue
        ? `${topByQuantity.name} bán nhiều nhất, còn ${topByRevenue.name} tạo doanh thu cao nhất.`
        : "Chưa đủ dữ liệu sản phẩm để phân tích.",
    },
    buyingBehavior: {
      paymentNote: dominantPaymentMethod
        ? `${dominantPaymentMethod} là phương thức thanh toán chiếm ưu thế trong kỳ.`
        : "Chưa có phương thức thanh toán chiếm ưu thế rõ ràng.",
      dominantPaymentMethod,
      cashAmount,
      qrAmount,
      note: `AOV đạt ${formatVnd(input.summary.averageOrderValue)} trên mỗi hóa đơn.`,
    },
    anomalies,
    limitations,
  };
}

export async function buildAiBusinessContext(startDate: string, endDate: string): Promise<AiBusinessContext> {
  const previousPeriod = getPreviousPeriod(startDate, endDate);
  const [
    summary,
    previousSummary,
    trendRows,
    previousTrendRows,
    hourlyRevenue,
    categoryRevenue,
    soldProducts,
    slowProducts,
    paymentSummary,
    cancelledOrders,
    previousCancelledOrders,
    inventoryContext,
  ] = await Promise.all([
    getFinancialSummary(startDate, endDate),
    getFinancialSummary(previousPeriod.startDate, previousPeriod.endDate),
    getFinancialTrend(startDate, endDate),
    getFinancialTrend(previousPeriod.startDate, previousPeriod.endDate),
    getAiHourlyRevenue(startDate, endDate),
    getAiCategoryRevenue(startDate, endDate),
    getAiSoldProducts(startDate, endDate),
    getAiSlowProducts(startDate, endDate),
    getAiPaymentSummary(startDate, endDate),
    getAiCancelledOrders(startDate, endDate),
    getAiCancelledOrders(previousPeriod.startDate, previousPeriod.endDate),
    getInventoryContext(),
  ]);

  const lowStockItems = inventoryContext.items;
  const trend = fillMissingRevenueDays(startDate, endDate, trendRows);
  const previousTrend = fillMissingRevenueDays(
    previousPeriod.startDate,
    previousPeriod.endDate,
    previousTrendRows
  );

  const revenueGrowthPercent = getGrowthPercent(summary.totalRevenue, previousSummary.totalRevenue);
  const ordersGrowthPercent = getGrowthPercent(summary.totalOrders, previousSummary.totalOrders);
  const dataQuality = buildDataQuality({
    totalOrders: summary.totalOrders,
    previousTotalOrders: previousSummary.totalOrders,
    trendCount: trendRows.length,
    hourlyRevenueCount: hourlyRevenue.length,
    soldProductsCount: soldProducts.length,
    paymentSummaryCount: paymentSummary.length,
    inventoryQueryAvailable: inventoryContext.available,
    categoryRevenueCount: categoryRevenue.length,
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
    previousCancelledOrders,
    lowStockItems,
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
      startDate: previousPeriod.startDate,
      endDate: previousPeriod.endDate,
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
    previousCancelledOrders,
    lowStockItems,
    advancedAnalysis,
  };
}
