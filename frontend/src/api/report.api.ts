import { apiData } from "./api-client";
import type {
  EmployeeRevenue,
  FinancialReport,
  InventoryValuationReport,
  EmployeePerformance,
  ComparisonReport,
  CustomerRetentionReport,
} from "../types/report";
export type AiReportChart = {
  tieu_de: string;
  loai: "line" | "bar" | "pie";
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
};

export type AiReportInsightData = {
  du_bao_mai: string;
  meo_doanh_thu: string;
  canh_bao: string;
  bieu_do: AiReportChart;
};

export type AiReportInsightResponse = {
  success: boolean;
  fallback: boolean;
  data: AiReportInsightData | null;
  message?: string;
  context?: unknown;
};
function buildDateQuery(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function getEmployeeRevenue(
  startDate?: string,
  endDate?: string
): Promise<EmployeeRevenue[]> {
  return apiData<EmployeeRevenue[]>({
    method: "GET",
    url: `/reports/employee-revenue${buildDateQuery(startDate, endDate)}`,
  });
}

export function getFinancialReport(
  startDate?: string,
  endDate?: string
): Promise<FinancialReport> {
  return apiData<FinancialReport>({
    method: "GET",
    url: `/reports/financial${buildDateQuery(startDate, endDate)}`,
  });
}

export function getInventoryValuation(): Promise<InventoryValuationReport> {
  return apiData<InventoryValuationReport>({
    method: "GET",
    url: "/reports/inventory-value",
  });
}

export function getEmployeePerformanceReport(
  startDate?: string,
  endDate?: string
): Promise<EmployeePerformance[]> {
  return apiData<EmployeePerformance[]>({
    method: "GET",
    url: `/reports/employee-performance${buildDateQuery(startDate, endDate)}`,
  });
}

export function getComparisonReport(
  startDate: string,
  endDate: string
): Promise<ComparisonReport> {
  const params = new URLSearchParams({ startDate, endDate });

  return apiData<ComparisonReport>({
    method: "GET",
    url: `/reports/comparison?${params.toString()}`,
  });
}

export function getCustomerRetention(
  startDate?: string,
  endDate?: string
): Promise<CustomerRetentionReport[]> {
  return apiData<CustomerRetentionReport[]>({
    method: "GET",
    url: `/reports/customer-retention${buildDateQuery(startDate, endDate)}`,
  });
}

export function getAiReportInsights(
  startDate?: string,
  endDate?: string
): Promise<AiReportInsightResponse> {
  return apiData<AiReportInsightResponse>({
    method: "GET",
    url: `/reports/ai-insights${buildDateQuery(startDate, endDate)}`,
  });
}