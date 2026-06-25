import { API_BASE_URL } from "./api-base";
import type { AuditLogQuery, AuditLogResponse } from "../types/audit-log";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getAuditLogs(query: AuditLogQuery): Promise<AuditLogResponse> {
  const searchParams = new URLSearchParams();
  if (query.page) searchParams.set("page", String(query.page));
  if (query.limit) searchParams.set("limit", String(query.limit));
  if (query.search) searchParams.set("search", query.search);
  if (query.actionType) searchParams.set("actionType", query.actionType);
  if (query.shiftId) searchParams.set("shiftId", query.shiftId);
  if (query.startDate) searchParams.set("startDate", query.startDate);
  if (query.endDate) searchParams.set("endDate", query.endDate);

  const url = `${API_BASE_URL}/audit-logs?${searchParams.toString()}`;

  const response = await fetch(url, { headers: getAuthHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi lấy nhật ký hệ thống");
  }

  return data.data;
}

export async function createAuditLog(payload: {
  actionType: string;
  targetObject: string;
  description: string;
  oldValues?: JsonValue;
  newValues?: JsonValue;
}): Promise<void> {
  const url = `${API_BASE_URL}/audit-logs`;
  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Lỗi ghi nhận nhật ký hệ thống");
  }
}
