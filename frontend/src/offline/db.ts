import type { Product } from "../api/product.api";
import type { Promotion } from "../api/promotions.api";
import type { Shift } from "../api/shifts.api";
import type {
  CartDraft,
  OutboxOrder,
  OutboxOrderStatus,
  PosOfflineSnapshot,
} from "./types";

const DB_NAME = "quickserve-pos-offline";
const DB_VERSION = 1;
const PRODUCTS_STORE = "products_snapshot";
const CART_STORE = "cart_draft";
const OUTBOX_STORE = "orders_outbox";
const META_STORE = "sync_meta";
const OFFLINE_CHANGE_EVENT = "quickserve:offline-state-changed";

type SyncMetaRecord<T = unknown> = {
  key: string;
  value: T;
  updatedAt: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function emitOfflineChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_CHANGE_EVENT));
  }
}

function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function openOfflineDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(PRODUCTS_STORE)) {
          database.createObjectStore(PRODUCTS_STORE, { keyPath: "id" });
        }

        if (!database.objectStoreNames.contains(CART_STORE)) {
          database.createObjectStore(CART_STORE, { keyPath: "id" });
        }

        if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
          const outbox = database.createObjectStore(OUTBOX_STORE, {
            keyPath: "localOrderId",
          });
          outbox.createIndex("status", "status", { unique: false });
          outbox.createIndex("operationId", "operationId", { unique: true });
          outbox.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = null;
        reject(request.error ?? new Error("Không mở được bộ nhớ offline."));
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(
          new Error("Bộ nhớ offline đang được dùng bởi một phiên bản ứng dụng cũ.")
        );
      };
    });
  }

  return databasePromise;
}

export async function savePosSnapshot(
  products: Product[],
  promotions: Promotion[],
  shifts: Shift[]
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(
    [PRODUCTS_STORE, META_STORE],
    "readwrite"
  );
  const productStore = transaction.objectStore(PRODUCTS_STORE);
  const metaStore = transaction.objectStore(META_STORE);
  const savedAt = new Date().toISOString();

  productStore.clear();
  products.forEach((product) => productStore.put(product));
  metaStore.put({ key: "promotionsSnapshot", value: promotions, updatedAt: savedAt });
  metaStore.put({ key: "shiftsSnapshot", value: shifts, updatedAt: savedAt });
  metaStore.put({ key: "lastSnapshotAt", value: savedAt, updatedAt: savedAt });

  await transactionDone(transaction);
  emitOfflineChange();
}

export async function saveProductsSnapshot(products: Product[]) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(
    [PRODUCTS_STORE, META_STORE],
    "readwrite"
  );
  const store = transaction.objectStore(PRODUCTS_STORE);
  const savedAt = new Date().toISOString();

  store.clear();
  products.forEach((product) => store.put(product));
  transaction.objectStore(META_STORE).put({
    key: "lastSnapshotAt",
    value: savedAt,
    updatedAt: savedAt,
  });

  await transactionDone(transaction);
  emitOfflineChange();
}

export async function loadPosSnapshot(): Promise<PosOfflineSnapshot> {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(
    [PRODUCTS_STORE, META_STORE],
    "readonly"
  );
  const metaStore = transaction.objectStore(META_STORE);
  const productsRequest = transaction
    .objectStore(PRODUCTS_STORE)
    .getAll() as IDBRequest<Product[]>;
  const promotionsRequest = metaStore.get(
    "promotionsSnapshot"
  ) as IDBRequest<SyncMetaRecord<Promotion[]> | undefined>;
  const shiftsRequest = metaStore.get(
    "shiftsSnapshot"
  ) as IDBRequest<SyncMetaRecord<Shift[]> | undefined>;
  const savedAtRequest = metaStore.get(
    "lastSnapshotAt"
  ) as IDBRequest<SyncMetaRecord<string> | undefined>;

  const [products, promotions, shifts, savedAt] = await Promise.all([
    requestResult(productsRequest),
    requestResult(promotionsRequest),
    requestResult(shiftsRequest),
    requestResult(savedAtRequest),
  ]);
  await transactionDone(transaction);

  return {
    products,
    promotions: promotions?.value ?? [],
    shifts: shifts?.value ?? [],
    savedAt: savedAt?.value ?? null,
  };
}

export async function getProductsSnapshot() {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(PRODUCTS_STORE, "readonly");
  const products = await requestResult(
    transaction.objectStore(PRODUCTS_STORE).getAll() as IDBRequest<Product[]>
  );
  await transactionDone(transaction);
  return products;
}

export async function getCartDraft(id: string) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(CART_STORE, "readonly");
  const draft = await requestResult(
    transaction.objectStore(CART_STORE).get(id) as IDBRequest<CartDraft | undefined>
  );
  await transactionDone(transaction);
  return draft ?? null;
}

export async function saveCartDraft(draft: CartDraft) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(CART_STORE, "readwrite");
  transaction.objectStore(CART_STORE).put(draft);
  await transactionDone(transaction);
}

export async function deleteCartDraft(id: string) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(CART_STORE, "readwrite");
  transaction.objectStore(CART_STORE).delete(id);
  await transactionDone(transaction);
}

async function applyStockChanges(
  transaction: IDBTransaction,
  order: OutboxOrder,
  direction: -1 | 1
) {
  const productStore = transaction.objectStore(PRODUCTS_STORE);
  const products = await Promise.all(
    order.payload.items.map((item) =>
      requestResult(productStore.get(item.productId) as IDBRequest<Product | undefined>)
    )
  );

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const item = order.payload.items[index];

    if (
      !product ||
      !product.isTrackedStock ||
      product.stockQuantity == null
    ) {
      continue;
    }

    const nextQuantity = product.stockQuantity + direction * item.quantity;
    if (direction < 0 && nextQuantity < 0) {
      throw new Error(`Không đủ tồn kho offline cho sản phẩm "${product.name}".`);
    }

    productStore.put({
      ...product,
      stockQuantity: nextQuantity,
      status: nextQuantity <= 0 ? "out_of_stock" : product.status,
    });
  }
}

export async function enqueueOutboxOrder(
  order: OutboxOrder,
  applyLocalStock: boolean
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(
    [OUTBOX_STORE, PRODUCTS_STORE],
    "readwrite"
  );

  try {
    if (applyLocalStock) {
      await applyStockChanges(transaction, order, -1);
      order.localStockApplied = true;
    }
    transaction.objectStore(OUTBOX_STORE).add(order);
    await transactionDone(transaction);
    emitOfflineChange();
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // Transaction may already have been aborted by IndexedDB.
    }
    throw error;
  }
}

export async function applyLocalStockForOrder(localOrderId: string) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(
    [OUTBOX_STORE, PRODUCTS_STORE],
    "readwrite"
  );
  const outboxStore = transaction.objectStore(OUTBOX_STORE);

  try {
    const order = await requestResult(
      outboxStore.get(localOrderId) as IDBRequest<OutboxOrder | undefined>
    );
    if (!order || order.localStockApplied) {
      await transactionDone(transaction);
      return;
    }

    await applyStockChanges(transaction, order, -1);
    outboxStore.put({
      ...order,
      localStockApplied: true,
      updatedAt: new Date().toISOString(),
    });
    await transactionDone(transaction);
    emitOfflineChange();
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // Transaction may already have been aborted by IndexedDB.
    }
    throw error;
  }
}

export async function getOutboxOrder(localOrderId: string) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(OUTBOX_STORE, "readonly");
  const order = await requestResult(
    transaction
      .objectStore(OUTBOX_STORE)
      .get(localOrderId) as IDBRequest<OutboxOrder | undefined>
  );
  await transactionDone(transaction);
  return order ?? null;
}

export async function listOutboxOrders() {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(OUTBOX_STORE, "readonly");
  const orders = await requestResult(
    transaction.objectStore(OUTBOX_STORE).getAll() as IDBRequest<OutboxOrder[]>
  );
  await transactionDone(transaction);
  return orders.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listSyncableOutboxOrders() {
  const orders = await listOutboxOrders();
  return orders
    .filter((order) => order.status === "PENDING" || order.status === "SYNCING")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function updateOutboxOrder(
  localOrderId: string,
  update: (order: OutboxOrder) => OutboxOrder
) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(OUTBOX_STORE, "readwrite");
  const store = transaction.objectStore(OUTBOX_STORE);
  const current = await requestResult(
    store.get(localOrderId) as IDBRequest<OutboxOrder | undefined>
  );

  if (!current) {
    transaction.abort();
    throw new Error(`Không tìm thấy đơn offline ${localOrderId}.`);
  }

  const next = update(current);
  store.put(next);
  await transactionDone(transaction);
  emitOfflineChange();
  return next;
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(META_STORE, "readonly");
  const record = await requestResult(
    transaction.objectStore(META_STORE).get(key) as IDBRequest<
      SyncMetaRecord<T> | undefined
    >
  );
  await transactionDone(transaction);
  return record?.value ?? null;
}

export async function setMeta<T>(key: string, value: T) {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(META_STORE, "readwrite");
  transaction.objectStore(META_STORE).put({
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
  await transactionDone(transaction);
  emitOfflineChange();
}

export async function nextLocalOrderIdentity() {
  const database = await openOfflineDatabase();
  const transaction = database.transaction(META_STORE, "readwrite");
  const store = transaction.objectStore(META_STORE);
  const [terminalRecord, sequenceRecord] = await Promise.all([
    requestResult(
      store.get("terminalId") as IDBRequest<SyncMetaRecord<string> | undefined>
    ),
    requestResult(
      store.get("localSequence") as IDBRequest<SyncMetaRecord<number> | undefined>
    ),
  ]);
  const now = new Date().toISOString();
  const terminalId = terminalRecord?.value ?? createUuid();
  const sequence = (sequenceRecord?.value ?? 0) + 1;

  store.put({ key: "terminalId", value: terminalId, updatedAt: now });
  store.put({ key: "localSequence", value: sequence, updatedAt: now });
  await transactionDone(transaction);

  return {
    terminalId,
    sequence,
    localOrderId: `${sequence.toString().padStart(8, "0")}-${terminalId}`,
    operationId: createUuid(),
  };
}

export function subscribeOfflineChanges(listener: () => void) {
  window.addEventListener(OFFLINE_CHANGE_EVENT, listener);
  return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, listener);
}

export function isPendingOutboxStatus(status: OutboxOrderStatus) {
  return status === "PENDING" || status === "SYNCING";
}
