import { findCustomerByPhone } from "../repositories/customers.repository";
import { createPosOrderTransaction } from "../repositories/pos.repository";
import type {
  CreatePosOrderBody,
  NormalizedPosOrderItem,
  PosPaymentMethod,
} from "../types/pos.types";
import { ApiError } from "../utils/apiError";

const allowedPaymentMethods: PosPaymentMethod[] = ["cash", "qr", "card"];

function normalizeItems(items: CreatePosOrderBody["items"]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Vui lòng chọn sản phẩm cần bán");
  }

  const itemMap = new Map<string, number>();

  for (const item of items) {
    const productId = item.productId?.trim();
    const quantity = Number(item.quantity);

    if (!productId) {
      throw new ApiError(400, "Thiếu sản phẩm trong đơn hàng");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, "Số lượng sản phẩm không hợp lệ");
    }

    itemMap.set(productId, (itemMap.get(productId) ?? 0) + quantity);
  }

  return Array.from(itemMap.entries()).map<NormalizedPosOrderItem>(
    ([productId, quantity]) => ({
      productId,
      quantity,
    })
  );
}

export async function createPosOrderService(
  body: CreatePosOrderBody,
  createdBy: string
) {
  const paymentMethod = body.paymentMethod ?? "cash";

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    throw new ApiError(400, "Phương thức thanh toán không hợp lệ");
  }

  const items = normalizeItems(body.items);
  let customerId = body.customerId?.trim() || null;
  const customerPhone = body.customerPhone?.replace(/\s+/g, "").trim();

  if (!customerId && customerPhone) {
    const customer = await findCustomerByPhone(customerPhone);
    customerId = customer?.id ?? null;
  }

  const { db } = await import("../config/database");
  const [shifts] = await db.execute<any[]>(
    "SELECT id, opening_cash FROM shifts WHERE user_id = ? AND status = 'OPEN' LIMIT 1",
    [createdBy]
  );
  const shiftId = shifts[0]?.id || null;

  if (!shiftId) {
    throw new ApiError(409, "Bạn cần mở ca làm trước khi bán hàng.");
  }

  if (Number(shifts[0]?.opening_cash || 0) <= 0) {
    throw new ApiError(409, "Bạn cần nhập tiền đầu ca trước khi bán hàng.");
  }

  return createPosOrderTransaction({
    customerId,
    createdBy,
    paymentMethod,
    note: body.note?.trim() || null,
    items,
    promotionCode: body.promotionCode?.trim() || null,
    changeAmount: body.changeAmount ?? 0,
    discountAmount: Number(body.discountAmount) || 0,
    shiftId,
  });
}
