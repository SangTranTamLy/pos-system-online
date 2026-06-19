export type ShiftStatus = 'PENDING' | 'APPROVED' | 'OPENING_REQUEST' | 'OPEN' | 'CLOSING_REQUEST' | 'CLOSED' | 'CANCELLED';

export interface Shift {
  id: string;
  userId: string;
  expectedStartTime: string; // ISO string
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
  
  // Extended fields from JOINs
  userName?: string;
  approvedByName?: string;
  openedByName?: string;
  closedByName?: string;
}

export interface CreateShiftPayload {
  expectedStartTime: string;
  expectedEndTime: string;
}

export interface ApproveShiftPayload {
  // Empty or could have notes
}

export interface RequestOpenShiftPayload {
  openingCash: number;
}

export interface OpenShiftPayload {
  // Empty payload
}

export interface CloseShiftPayload {
  actualClosingCash: number;
  closingNote?: string;
}
