import {
  countCustomers,
  countOrdersByCustomerId,
  createCustomer,
  deleteCustomerById,
  findCustomerByPhone,
  findCustomerOrders,
  findCustomerProfileById,
  findCustomers,
  updateCustomer,
} from "../repositories/customers.repository";
import type {
  CreateCustomerBody,
  CustomerListQuery,
  UpdateCustomerBody,
} from "../types/customer.types";
import { ApiError } from "../utils/apiError";

function normalizeName(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/\D/g, "").trim() ?? "";
}

function normalizeAddress(value: string | null | undefined) {
  const address = value?.trim();
  return address || null;
}

function normalizeMoney(value: number | undefined) {
  if (value === undefined || value === null) return 0;
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, "Tổng chi tiêu không hợp lệ.");
  }

  return amount;
}

function validateCustomerBase(fullName: string, phone: string) {
  if (!fullName) {
    throw new ApiError(400, "Vui lòng nhập tên khách hàng.");
  }

  if (!phone) {
    throw new ApiError(400, "Vui lòng nhập số điện thoại.");
  }

  if (!/^[0-9]{10}$/.test(phone)) {
    throw new ApiError(400, "Số điện thoại phải gồm đúng 10 chữ số.");
  }
}

function parseNumber(value: number | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export async function getCustomersService(query: CustomerListQuery) {
  const normalizedQuery: CustomerListQuery = {
    q: query.q?.trim(),
    limit: parseNumber(query.limit, 100),
    offset: parseNumber(query.offset, 0),
  };

  const [customers, total] = await Promise.all([
    findCustomers(normalizedQuery),
    countCustomers(normalizedQuery),
  ]);

  return {
    customers,
    total,
    limit: normalizedQuery.limit ?? 100,
    offset: normalizedQuery.offset ?? 0,
  };
}

export async function searchCustomersService(query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  return findCustomers({
    q: trimmedQuery,
    limit: 20,
    offset: 0,
  });
}

export async function getCustomerService(id: string) {
  const customer = await findCustomerProfileById(id);

  if (!customer) {
    throw new ApiError(404, "Không tìm thấy khách hàng.");
  }

  return customer;
}

import { createAuditLog } from "../repositories/audit-log.repository";

export async function createCustomerService(body: CreateCustomerBody, userId?: string) {
  const fullName = normalizeName(body.fullName);
  const phone = normalizePhone(body.phone);
  const address = normalizeAddress(body.address);

  validateCustomerBase(fullName, phone);

  const existingCustomer = await findCustomerByPhone(phone);

  if (existingCustomer) {
    throw new ApiError(409, "Số điện thoại này đã được dùng cho khách hàng khác.");
  }

  const customer = await createCustomer({
    fullName,
    phone,
    address,
    totalSpent: normalizeMoney(body.totalSpent),
  });

  if (userId) {
    void createAuditLog(
      userId,
      "SUA_KHACH_HANG",
      `Khách hàng: ${customer.fullName}`,
      `Tạo khách hàng mới: ${customer.fullName} (SĐT: ${customer.phone}).`,
      null,
      customer
    );
  }

  return customer;
}

export async function updateCustomerService(
  id: string,
  body: UpdateCustomerBody,
  userId?: string
) {
  const currentCustomer = await getCustomerService(id);
  const fullName = normalizeName(body.fullName);
  const phone = normalizePhone(body.phone);
  const address = normalizeAddress(body.address);

  validateCustomerBase(fullName, phone);

  const existingCustomer = await findCustomerByPhone(phone);

  if (existingCustomer && existingCustomer.id !== currentCustomer.id) {
    throw new ApiError(409, "Số điện thoại này đã được dùng cho khách hàng khác.");
  }

  const updatedCustomer = await updateCustomer(id, {
    fullName,
    phone,
    address,
  });

  if (!updatedCustomer) {
    throw new ApiError(404, "Không tìm thấy khách hàng.");
  }

  if (userId) {
    void createAuditLog(
      userId,
      "SUA_KHACH_HANG",
      `Khách hàng: ${updatedCustomer.fullName}`,
      `Cập nhật thông tin khách hàng: ${updatedCustomer.fullName}.`,
      currentCustomer,
      updatedCustomer
    );
  }

  return updatedCustomer;
}

export async function deleteCustomerService(id: string, userId?: string) {
  const currentCustomer = await getCustomerService(id);
  const orderCount = await countOrdersByCustomerId(id);

  if (orderCount > 0) {
    throw new ApiError(
      409,
      "Không thể xóa khách hàng đã có hóa đơn. Vui lòng giữ lại hồ sơ để bảo toàn lịch sử mua hàng."
    );
  }

  const deleted = await deleteCustomerById(id);

  if (!deleted) {
    throw new ApiError(404, "Không tìm thấy khách hàng.");
  }

  if (userId) {
    void createAuditLog(
      userId,
      "SUA_KHACH_HANG",
      `Khách hàng: ${currentCustomer.fullName}`,
      `Xóa thông tin khách hàng: ${currentCustomer.fullName}.`,
      currentCustomer,
      null
    );
  }

  return currentCustomer;
}

export async function getCustomerOrdersService(id: string) {
  await getCustomerService(id);
  return findCustomerOrders(id);
}
