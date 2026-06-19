import type { EmployeeRevenue } from "../types/report";

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
