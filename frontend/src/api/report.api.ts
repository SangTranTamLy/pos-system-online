import { apiData } from "./api-client";
import type {
  EmployeeRevenue,
  FinancialReport,
  InventoryValuationReport,
  EmployeePerformance,
  ComparisonReport,
  CustomerRetentionReport,
} from "../types/report";
export type AiConfidence = "cao" | "trung_binh" | "thap" | string;
export type AiPriority = "cao" | "trung_binh" | "thap" | string;
export type AiChartType = "line" | "bar" | "pie" | "horizontal_bar" | string;
export type AiValidationResult = {
  passed?: boolean;
  message?: string;
  failed_reason?: string;
};

export type AiReportChart = {
  title?: string;
  type?: AiChartType;
  tieu_de?: string;
  loai?: AiChartType;
  labels?: string[];
  datasets?: Array<{
    label?: string;
    data?: number[];
  }>;
  context_note?: string;
};

export type AiReportTable = {
  title?: string;
  columns?: string[];
  rows?: Array<Array<string | number | null>>;
  validation_note?: string;
};

export type AiReportTables = {
  orders_table?: AiReportTable;
  order_details_table?: AiReportTable;
  products_table?: AiReportTable;
  categories_table?: AiReportTable;
  inventory_table?: AiReportTable;
  sales_table?: AiReportTable;
  payment_table?: AiReportTable;
  employee_table?: AiReportTable;
};

export type AiReportInsightData = {
  meta?: {
    assistant_name?: string;
    role?: string;
    period?: {
      from?: string;
      to?: string;
    };
    confidence?: AiConfidence;
    score?: number;
    confidence_note?: string;
    status?: string;
    data_status?: string;
  };
  summary?: {
    main_insight?: string;
    revenue_text?: string;
    orders_text?: string;
    best_selling_product?: string;
    best_shift?: string;
  };
  insights?: Array<{
    data?: string;
    validation?: AiValidationResult;
    title?: string;
    description?: string;
    evidence?: string;
    root_cause?: string;
    confidence?: AiConfidence;
    confidence_score?: number;
    recommendation?: string;
  }>;
  possible_causes?: Array<{
    data?: string;
    validation?: AiValidationResult;
    title?: string;
    description?: string;
    evidence?: string;
    confidence?: AiConfidence;
    confidence_score?: number;
    recommendation?: string;
  }>;
  action_plan?: Array<{
    priority?: AiPriority;
    action?: string;
    reason?: string;
    expected_result?: string;
  }>;
  warnings?: Array<{
    data?: string;
    validation?: AiValidationResult;
    type?: string;
    level?: AiPriority;
    message?: string;
    suggestion?: string;
    confidence_score?: number;
  }>;
  phan_tich_chuyen_sau?: Array<{
    thu_tu?: number;
    loai?: "xu_huong_doanh_thu" | "nguyen_nhan_bien_dong" | "san_pham" | "hanh_vi_mua" | "rui_ro_co_hoi" | string;
    tieu_de?: string;
    noi_dung?: string;
    muc_do?: "positive" | "neutral" | "warning" | "critical" | string;
  }>;
  report_tables?: AiReportTables;
  chart_suggestions?: AiReportChart[];
  du_bao_mai?: string;
  meo_doanh_thu?: string;
  canh_bao?: string;
  bieu_do?: AiReportChart;
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
  startDate: string,
  endDate: string
): Promise<AiReportInsightResponse> {
  return apiData<AiReportInsightResponse>({
    method: "POST",
    url: "/reports/ai-insights",
    data: { startDate, endDate },
    timeout: 60_000,
  });
}
