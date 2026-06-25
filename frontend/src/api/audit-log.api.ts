import { apiData } from "./api-client";
import type { AuditLogQuery, AuditLogResponse } from "../types/audit-log";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function getAuditLogs(
  query: AuditLogQuery
): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.actionType) params.set("actionType", query.actionType);
  if (query.shiftId) params.set("shiftId", query.shiftId);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);

  return apiData<AuditLogResponse>({
    method: "GET",
    url: `/audit-logs?${params.toString()}`,
  });
}

export async function createAuditLog(payload: {
  actionType: string;
  targetObject: string;
  description: string;
  oldValues?: JsonValue;
  newValues?: JsonValue;
}): Promise<void> {
  await apiData<unknown>({
    method: "POST",
    url: "/audit-logs",
    data: payload,
  });
}
