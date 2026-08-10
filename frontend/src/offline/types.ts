import type { Product } from "../api/product.api";
import type { Promotion } from "../api/promotions.api";
import type {
  PosOrderResult,
  SyncPosOrderPayload,
} from "../api/pos.api";
import type { Shift } from "../api/shifts.api";

export type OfflineCartItem = {
  product: Product;
  quantity: number;
};

export type CartDraft = {
  id: string;
  userId: string;
  items: OfflineCartItem[];
  paymentMethod: "cash" | "qr";
  note: string;
  promotionCode: string;
  cashPaid: string;
  customerPhone: string;
  savedAt: string;
};

export type OutboxOrderStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "REJECTED"
  | "CONFLICT_STOCK";

export type OutboxOrder = {
  localOrderId: string;
  operationId: string;
  terminalId: string;
  sequence: number;
  userId: string;
  shiftId: string | null;
  status: OutboxOrderStatus;
  payload: SyncPosOrderPayload;
  receipt: PosOrderResult;
  attempts: number;
  lastError: string | null;
  lastStatusCode: number | null;
  serverOrderId: string | null;
  localStockApplied: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PosOfflineSnapshot = {
  products: Product[];
  promotions: Promotion[];
  shifts: Shift[];
  savedAt: string | null;
};

export type OfflineSyncSummary = {
  synced: number;
  rejected: number;
  pending: number;
  networkUnavailable: boolean;
};
