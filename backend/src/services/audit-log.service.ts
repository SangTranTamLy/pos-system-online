import { getAuditLogs } from "../repositories/audit-log.repository";
import type { AuditLogQuery } from "../types/audit-log.types";

export async function getAuditLogsService(query: AuditLogQuery & { shiftId?: string; actionType?: string }) {
  return getAuditLogs(query);
}
