import type { 
  EmployeeRevenue,
  FinancialReport,
  InventoryValuationReport,
  EmployeePerformance,
  ComparisonReport,
  CustomerRetentionReport
} from "../types/report";

const API_BASE_URL = "http://localhost:5000/api";

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getEmployeeRevenue(
  startDate?: string,
  endDate?: string
): Promise<EmployeeRevenue[]> {
  const searchParams = new URLSearchParams();
  if (startDate) searchParams.set("startDate", startDate);
  if (endDate) searchParams.set("endDate", endDate);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/reports/employee-revenue${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi lấy dữ liệu doanh thu nhân viên");
  }

  return data.data;
}

// 1. Lấy báo cáo tài chính
export async function getFinancialReport(
  startDate?: string,
  endDate?: string
): Promise<FinancialReport> {
  const searchParams = new URLSearchParams();
  if (startDate) searchParams.set("startDate", startDate);
  if (endDate) searchParams.set("endDate", endDate);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/reports/financial${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi lấy dữ liệu báo cáo tài chính");
  }

  return data.data;
}

// 2. Lấy báo cáo giá trị kho
export async function getInventoryValuation(): Promise<InventoryValuationReport> {
  const url = `${API_BASE_URL}/reports/inventory-value`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi lấy dữ liệu báo cáo tồn kho");
  }

  return data.data;
}

// 3. Lấy báo cáo hiệu suất nhân viên
export async function getEmployeePerformanceReport(
  startDate?: string,
  endDate?: string
): Promise<EmployeePerformance[]> {
  const searchParams = new URLSearchParams();
  if (startDate) searchParams.set("startDate", startDate);
  if (endDate) searchParams.set("endDate", endDate);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/reports/employee-performance${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi lấy dữ liệu hiệu suất nhân viên");
  }

  return data.data;
}

// 4. Lấy báo cáo so sánh & tăng trưởng
export async function getComparisonReport(
  startDate: string,
  endDate: string
): Promise<ComparisonReport> {
  const searchParams = new URLSearchParams();
  searchParams.set("startDate", startDate);
  searchParams.set("endDate", endDate);

  const url = `${API_BASE_URL}/reports/comparison?${searchParams.toString()}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi lấy dữ liệu báo cáo so sánh");
  }

  return data.data;
}

// 5. Lấy báo cáo khách hàng thân thiết
export async function getCustomerRetention(
  startDate?: string,
  endDate?: string
): Promise<CustomerRetentionReport[]> {
  const searchParams = new URLSearchParams();
  if (startDate) searchParams.set("startDate", startDate);
  if (endDate) searchParams.set("endDate", endDate);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/reports/customer-retention${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi lấy dữ liệu báo cáo khách hàng");
  }

  return data.data;
}
