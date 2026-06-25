import { apiData } from "./api-client";

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

export function fetchShifts(): Promise<Shift[]> {
  return apiData<Shift[]>({ method: "GET", url: "/shifts" });
}

export function fetchShiftRevenueByShift(
  days = 7
): Promise<ShiftRevenueSummaryItem[]> {
  return apiData<ShiftRevenueSummaryItem[]>({
    method: "GET",
    url: `/shifts/revenue-by-shift?days=${days}`,
  });
}

export function fetchStaffByShift(
  date?: string
): Promise<StaffByShiftSummaryItem[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiData<StaffByShiftSummaryItem[]>({
    method: "GET",
    url: `/shifts/staff-by-shift${query}`,
  });
}

export function registerShift(
  expectedStartTime: string,
  expectedEndTime: string
): Promise<Shift> {
  return apiData<Shift>({
    method: "POST",
    url: "/shifts",
    data: { expectedStartTime, expectedEndTime },
  });
}

export function openShiftForEmployee(
  payload: OpenShiftForEmployeePayload
): Promise<Shift> {
  return apiData<Shift>({
    method: "POST",
    url: "/shifts/open-for-employee",
    data: payload,
  });
}

export function approveShift(id: string): Promise<Shift> {
  return apiData<Shift>({ method: "PATCH", url: `/shifts/${id}/approve` });
}

export function requestOpenShift(
  id: string,
  openingCash: number
): Promise<Shift> {
  return apiData<Shift>({
    method: "PATCH",
    url: `/shifts/${id}/request-open`,
    data: { openingCash },
  });
}

export function setShiftOpeningCash(
  id: string,
  openingCash: number
): Promise<Shift> {
  return apiData<Shift>({
    method: "PATCH",
    url: `/shifts/${id}/opening-cash`,
    data: { openingCash },
  });
}

export function openShift(id: string): Promise<Shift> {
  return apiData<Shift>({ method: "PATCH", url: `/shifts/${id}/open` });
}

export function requestCloseShift(id: string): Promise<Shift> {
  return apiData<Shift>({
    method: "PATCH",
    url: `/shifts/${id}/request-close`,
  });
}

export function closeShift(
  id: string,
  actualClosingCash: number,
  closingNote?: string
): Promise<Shift> {
  return apiData<Shift>({
    method: "PATCH",
    url: `/shifts/${id}/close`,
    data: { actualClosingCash, closingNote },
  });
}

export function cancelShift(id: string): Promise<Shift> {
  return apiData<Shift>({ method: "PATCH", url: `/shifts/${id}/cancel` });
}
