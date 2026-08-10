import {
  PosSyncRequestError,
  syncPosOrder,
  type PosOrderSyncStatus,
} from "../api/pos.api";
import {
  listOutboxOrders,
  listSyncableOutboxOrders,
  setMeta,
  updateOutboxOrder,
} from "./db";
import type { OfflineSyncSummary, OutboxOrderStatus } from "./types";

let activeSync: Promise<OfflineSyncSummary> | null = null;

function getAuthenticatedUserId() {
  try {
    const storedUser = localStorage.getItem("auth_user");
    if (!storedUser) return null;
    const user = JSON.parse(storedUser) as { id?: unknown };
    return typeof user.id === "string" && user.id.trim() ? user.id : null;
  } catch {
    return null;
  }
}

function toRejectedStatus(
  status: PosOrderSyncStatus | null
): Extract<OutboxOrderStatus, "REJECTED" | "CONFLICT_STOCK"> {
  return status === "CONFLICT_STOCK" ? "CONFLICT_STOCK" : "REJECTED";
}

async function runSyncOutbox(): Promise<OfflineSyncSummary> {
  if (!navigator.onLine) {
    const orders = await listOutboxOrders();
    return {
      synced: 0,
      rejected: 0,
      pending: orders.filter(
        (order) => order.status === "PENDING" || order.status === "SYNCING"
      ).length,
      networkUnavailable: true,
    };
  }

  const currentUserId = getAuthenticatedUserId();
  const allOrders = await listOutboxOrders();
  if (!currentUserId) {
    return {
      synced: 0,
      rejected: 0,
      pending: allOrders.filter(
        (order) => order.status === "PENDING" || order.status === "SYNCING"
      ).length,
      networkUnavailable: false,
    };
  }

  const orders = (await listSyncableOutboxOrders()).filter(
    (order) => order.userId === currentUserId
  );
  let synced = 0;
  let rejected = 0;
  let networkUnavailable = false;

  for (const order of orders) {
    await updateOutboxOrder(order.localOrderId, (current) => ({
      ...current,
      status: "SYNCING",
      attempts: current.attempts + 1,
      lastError: null,
      lastStatusCode: null,
      updatedAt: new Date().toISOString(),
    }));

    try {
      const result = await syncPosOrder(order.payload);
      const now = new Date().toISOString();
      await updateOutboxOrder(order.localOrderId, (current) => ({
        ...current,
        status: "SYNCED",
        receipt: {
          ...result.order,
          syncStatus: result.status,
          localOrderId: current.localOrderId,
          operationId: current.operationId,
          createdAt: current.createdAt,
        },
        serverOrderId: result.order.id,
        lastError: null,
        lastStatusCode: null,
        updatedAt: now,
      }));
      await setMeta("lastSyncAt", now);
      synced += 1;
    } catch (error) {
      const syncError =
        error instanceof PosSyncRequestError
          ? error
          : new PosSyncRequestError(
              error instanceof Error ? error.message : "Đồng bộ thất bại.",
              null,
              null
            );

      if (syncError.isRetryable) {
        await updateOutboxOrder(order.localOrderId, (current) => ({
          ...current,
          status: "PENDING",
          lastError: syncError.message,
          lastStatusCode: syncError.statusCode,
          updatedAt: new Date().toISOString(),
        }));
        networkUnavailable =
          syncError.statusCode == null || syncError.statusCode >= 500;
        break;
      }

      const rejectedStatus = toRejectedStatus(syncError.syncStatus);
      await updateOutboxOrder(order.localOrderId, (current) => ({
        ...current,
        status: rejectedStatus,
        receipt: {
          ...current.receipt,
          syncStatus: rejectedStatus,
        },
        lastError: syncError.message,
        lastStatusCode: syncError.statusCode,
        updatedAt: new Date().toISOString(),
      }));
      rejected += 1;
    }
  }

  const currentOrders = await listOutboxOrders();
  return {
    synced,
    rejected,
    pending: currentOrders.filter(
      (order) => order.status === "PENDING" || order.status === "SYNCING"
    ).length,
    networkUnavailable,
  };
}

export function syncOutbox() {
  if (!activeSync) {
    activeSync = runSyncOutbox().finally(() => {
      activeSync = null;
    });
  }

  return activeSync;
}
