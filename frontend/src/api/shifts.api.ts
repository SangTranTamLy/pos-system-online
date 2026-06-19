const API_BASE_URL = "http://localhost:5000/api";

export type ShiftStatus = 'PENDING' | 'APPROVED' | 'OPENING_REQUEST' | 'OPEN' | 'CLOSING_REQUEST' | 'CLOSED' | 'CANCELLED';

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

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchShifts(): Promise<Shift[]> {
  const response = await fetch(`${API_BASE_URL}/shifts`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi lấy danh sách ca làm việc");
  return data.data;
}

export async function registerShift(expectedStartTime: string, expectedEndTime: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ expectedStartTime, expectedEndTime }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi đăng ký ca");
  return data.data;
}

export async function approveShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/approve`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi duyệt ca");
  return data.data;
}

export async function requestOpenShift(id: string, openingCash: number): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/request-open`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ openingCash }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi yêu cầu mở ca");
  return data.data;
}

export async function openShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/open`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi xác nhận mở ca");
  return data.data;
}

export async function requestCloseShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/request-close`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi yêu cầu đóng ca");
  return data.data;
}

export async function closeShift(id: string, actualClosingCash: number, closingNote?: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/close`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ actualClosingCash, closingNote }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi đóng ca");
  return data.data;
}

export async function cancelShift(id: string): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/cancel`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi hủy ca");
  return data.data;
}
