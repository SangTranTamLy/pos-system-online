import {
  cancelOrderById,
  findOrderById,
  findOrderDetailsByOrderId,
  findOrders,
  findPaymentsByOrderId,
} from "../repositories/order.repository";
import type { CancelOrderBody, OrderListQuery, OrderStatus } from "../types/order.types";
import { ApiError } from "../utils/apiError";

const allowedStatuses: OrderStatus[] = ["completed", "cancelled", "refunded"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function normalizeOrderQuery(query: Record<string, unknown>): OrderListQuery {
  const status = typeof query.status === "string" ? query.status : undefined;
  const search = typeof query.search === "string" ? query.search.trim() : undefined;
  const dateFrom = typeof query.dateFrom === "string" ? query.dateFrom.trim() : undefined;
  const dateTo = typeof query.dateTo === "string" ? query.dateTo.trim() : undefined;
  const createdBy = typeof query.createdBy === "string" ? query.createdBy.trim() : undefined;

  if (status && !allowedStatuses.includes(status as OrderStatus)) {
    throw new ApiError(400, "Trạng thái hóa đơn không hợp lệ");
  }

  if (dateFrom && !datePattern.test(dateFrom)) {
    throw new ApiError(400, "Từ ngày không hợp lệ");
  }

  if (dateTo && !datePattern.test(dateTo)) {
    throw new ApiError(400, "Đến ngày không hợp lệ");
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(400, "Từ ngày không được lớn hơn đến ngày");
  }

  return {
    status: status as OrderStatus | undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    createdBy: createdBy || undefined,
  };
}

function normalizeCancelReason(body: CancelOrderBody) {
  return (body.cancel_reason ?? body.reason)?.trim();
}

export async function getOrdersService(query: Record<string, unknown>) {
  return findOrders(normalizeOrderQuery(query));
}

export async function getOrderDetailService(id: string) {
  const order = await findOrderById(id);

  if (!order) {
    throw new ApiError(404, "Không tìm thấy hóa đơn");
  }

  const [details, payments] = await Promise.all([
    findOrderDetailsByOrderId(id),
    findPaymentsByOrderId(id),
  ]);

  return {
    ...order,
    details,
    payments,
  };
}

export async function cancelOrderService(
  id: string,
  cancelledBy: string,
  body: CancelOrderBody
) {
  const cancelReason = normalizeCancelReason(body);

  if (!cancelReason) {
    throw new ApiError(400, "Vui lòng nhập lý do hủy hóa đơn");
  }

  if (cancelReason.length > 500) {
    throw new ApiError(400, "Lý do hủy hóa đơn không được vượt quá 500 ký tự");
  }

  const order = await findOrderById(id);

  if (!order) {
    throw new ApiError(404, "Không tìm thấy hóa đơn");
  }

  if (order.status !== "completed") {
    throw new ApiError(409, "Chỉ có thể hủy hóa đơn đã hoàn tất");
  }

  const cancelledOrder = await cancelOrderById(id, cancelledBy, cancelReason);

  if (!cancelledOrder) {
    throw new ApiError(409, "Không thể hủy hóa đơn này");
  }

  return cancelledOrder;
}