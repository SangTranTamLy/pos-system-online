import {
  getAiCancelledOrders,
  getAiCategoryRevenue,
  getAiHourlyRevenue,
  getAiPaymentSummary,
  getAiSlowProducts,
  getAiSoldProducts,
  getAiMaterialPurchaseSummary,
  getRawMaterialValuation,
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
  materialInventory: Awaited<ReturnType<typeof getRawMaterialValuation>>;
  materialPurchases: Awaited<ReturnType<typeof getAiMaterialPurchaseSummary>>;
  previousMaterialPurchases: Awaited<ReturnType<typeof getAiMaterialPurchaseSummary>>;
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

function getGrowthPercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
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
    materialInventory,
    materialPurchases,
    previousMaterialPurchases,
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
    getRawMaterialValuation(),
    getAiMaterialPurchaseSummary(startDate, endDate),
    getAiMaterialPurchaseSummary(previousPeriod.startDate, previousPeriod.endDate),
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
    materialInventory,
    materialPurchases,
    previousMaterialPurchases,
  };
}
