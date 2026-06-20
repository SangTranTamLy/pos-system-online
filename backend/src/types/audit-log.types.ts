export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  userName: string | null;
  role: string | null; // TN / QL
  actionType: string;  // HUY_MON, GIAM_GIA, MO_KET, HOAN_TIEN, DANG_NHAP, DANG_XUAT, SUA_GIA, SUA_KHO
  targetObject: string | null;
  description: string | null;
  oldValues?: any;
  newValues?: any;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  search?: string;
  actionGroup?: string; // HUY_MON, GIAM_GIA, etc. or grouping
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
}
