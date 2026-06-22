export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  userName: string | null;
  role: string | null;
  actionType: string;
  targetObject: string | null;
  description: string | null;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  search?: string;
  actionType?: string;
  shiftId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
}
