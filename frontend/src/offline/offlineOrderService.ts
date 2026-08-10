import type {
  PosOrderResult,
  PosPromotionPreview,
} from "../api/pos.api";
import {
  enqueueOutboxOrder,
  getProductsSnapshot,
  nextLocalOrderIdentity,
} from "./db";
import type { OfflineCartItem, OutboxOrder } from "./types";

export type SubmitOfflineCashOrderInput = {
  items: OfflineCartItem[];
  userId: string;
  shiftId: string | null;
  customerId: string | null;
  customerPhone: string | null;
  note: string | null;
  promotionCode: string | null;
  promotionPreview: PosPromotionPreview | null;
  cashPaid: number;
};

function createLocalReceipt(
  input: SubmitOfflineCashOrderInput,
  identity: Awaited<ReturnType<typeof nextLocalOrderIdentity>>,
  createdAt: string
): PosOrderResult {
  const details = input.items.map((item) => ({
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${identity.localOrderId}-${item.product.id}`,
    productId: item.product.id,
    productName: item.product.name,
    categoryId: item.product.categoryId,
    categoryName: item.product.categoryName,
    quantity: item.quantity,
    unitPrice: item.product.salePrice,
    lineTotal: item.product.salePrice * item.quantity,
  }));
  const totalAmount = details.reduce((total, item) => total + item.lineTotal, 0);
  const discountAmount = Math.min(
    Math.max(input.promotionPreview?.discountAmount ?? 0, 0),
    totalAmount
  );
  const finalAmount = totalAmount - discountAmount;

  return {
    id: identity.localOrderId,
    localOrderId: identity.localOrderId,
    operationId: identity.operationId,
    createdAt,
    customerId: input.customerId,
    createdBy: input.userId,
    status: "completed",
    syncStatus: "PENDING",
    totalAmount,
    discountAmount,
    finalAmount,
    changeAmount: Math.max(0, input.cashPaid - finalAmount),
    note: input.note,
    appliedPromotion: input.promotionPreview?.appliedPromotion ?? null,
    details,
    payment: {
      id: `local-payment-${identity.operationId}`,
      paymentMethod: "cash",
      amount: finalAmount,
      paymentStatus: "paid",
    },
  };
}

export async function submitOfflineCashOrder(input: SubmitOfflineCashOrderInput) {
  if (navigator.onLine) {
    throw new Error(
      "Chỉ lưu đơn dự phòng khi thiết bị đã mất kết nối mạng."
    );
  }
  if (input.items.length === 0) {
    throw new Error("Giỏ hàng không có sản phẩm để thanh toán.");
  }
  if (!input.userId.trim()) {
    throw new Error("Không xác định được nhân viên đang bán hàng.");
  }

  const identity = await nextLocalOrderIdentity();
  const createdAt = new Date().toISOString();
  const receipt = createLocalReceipt(input, identity, createdAt);
  const order: OutboxOrder = {
    localOrderId: identity.localOrderId,
    operationId: identity.operationId,
    terminalId: identity.terminalId,
    sequence: identity.sequence,
    userId: input.userId,
    shiftId: input.shiftId,
    status: "PENDING",
    payload: {
      operationId: identity.operationId,
      terminalId: identity.terminalId,
      localOrderId: identity.localOrderId,
      clientCreatedAt: createdAt,
      customerId: input.customerId,
      customerPhone: input.customerPhone,
      shiftId: input.shiftId,
      paymentMethod: "cash",
      note: input.note,
      items: input.items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.salePrice,
      })),
      promotionCode: input.promotionCode,
      changeAmount: receipt.changeAmount,
      totalAmount: receipt.totalAmount,
      discountAmount: receipt.discountAmount,
      finalAmount: receipt.finalAmount,
    },
    receipt,
    attempts: 0,
    lastError: null,
    lastStatusCode: null,
    serverOrderId: null,
    localStockApplied: false,
    createdAt,
    updatedAt: createdAt,
  };

  await enqueueOutboxOrder(order, true);

  return {
    order: order.receipt,
    outboxOrder: order,
    products: await getProductsSnapshot(),
  };
}
