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
  getCustomerRetention
} from "../repositories/report.repository";
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

  // Cashier or Staff
  return getRevenueByEmployeeId(userId, startDate, endDate);
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

// 2. Service báo cáo tồn kho & giá trị kho
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

// 4. Service báo cáo so sánh & tăng trưởng
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
