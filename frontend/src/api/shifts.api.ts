import { API_BASE_URL } from "./api-base";
export type ShiftStatus =
  | "PENDING"
  | "APPROVED"
  | "OPENING_REQUEST"
  | "OPEN"
  | "CLOSING_REQUEST"
  | "CLOSED"
  | "CANCELLED";

export interface Shift {
  id: string;
  userId: string;
  expectedStartTime: string;
  expectedEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  status: ShiftStatus;
  approvedBy: string | null;
  openedBy: string | null;
  closedBy: string | null;
  openingCash: number;
  actualClosingCash: number;
  totalSalesCash: number;
  totalSalesQr: number;
  totalSales: number;
  variance: number;
  closingNote: string | null;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  approvedByName?: string;
  openedByName?: string;
  closedByName?: string;
}

export interface ShiftRevenueSummaryItem {
  date: string;
  label: string;
  morning: number;
  afternoon: number;
  night: number;
  total: number;
}

export interface StaffByShiftSummaryItem {
  key: "morning" | "afternoon" | "night";
  label: string;
  assigned: number;
  total: number;
  percentage: number;
}

export type OpenShiftForEmployeePayload = {
  userId: string;
  expectedStartTime: string;
  expectedEndTime: string;
  openingCash?: number;
};

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

async function readShiftResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || fallbackMessage);
  return data.data;
}

export async function fetchShifts(): Promise<Shift[]> {
  const response = await fetch(`${API_BASE_URL}/shifts`, {
    headers: getAuthHeaders(),
  });
  return readShiftResponse<Shift[]>(response, "Lỗi lấy danh sách ca làm");
}

export async function fetchShiftRevenueByShift(days = 7): Promise<ShiftRevenueSummaryItem[]> {
  const response = await fetch(`${API_BASE_URL}/shifts/revenue-by-shift?days=${days}`, {
    headers: getAuthHeaders(),
  });
  return readShiftResponse<ShiftRevenueSummaryItem[]>(response, "Loi lay doanh thu theo ca");
}

export async function fetchStaffByShift(date?: string): Promise<StaffByShiftSummaryItem[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(`${API_BASE_URL}/shifts/staff-by-shift${query}`, {
    headers: getAuthHeaders(),
  });
  return readShiftResponse<StaffByShiftSummaryItem[]>(response, "Loi lay nhan vien theo ca");
}

export async function registerShift(
  expectedStartTime: string,
  expectedEndTime: string
): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ expectedStartTime, expectedEndTime }),
  });
  return readShiftResponse<Shift>(response, "Lỗi đăng ký ca");
}

export async function openShiftForEmployee(
  payload: OpenShiftForEmployeePayload
): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/open-for-employee`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return readShiftResponse<Shift>(response, "Lỗi mở ca cho nhân viên");
}

export async function approveShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/approve`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return readShiftResponse<Shift>(response, "Lỗi duyệt ca");
}

export async function requestOpenShift(id: string, openingCash: number): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/request-open`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ openingCash }),
  });
  return readShiftResponse<Shift>(response, "Lỗi yêu cầu mở ca");
}

export async function setShiftOpeningCash(id: string, openingCash: number): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/opening-cash`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ openingCash }),
  });
  return readShiftResponse<Shift>(response, "Lỗi nhập tiền đầu ca");
}

export async function openShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/open`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return readShiftResponse<Shift>(response, "Lỗi xác nhận mở ca");
}

export async function requestCloseShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/request-close`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return readShiftResponse<Shift>(response, "Lỗi yêu cầu đóng ca");
}

export async function closeShift(
  id: string,
  actualClosingCash: number,
  closingNote?: string
): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/close`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ actualClosingCash, closingNote }),
  });
  return readShiftResponse<Shift>(response, "Lỗi đóng ca");
}

export async function cancelShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/cancel`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return readShiftResponse<Shift>(response, "Lỗi hủy ca");
}
