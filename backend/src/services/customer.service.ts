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
  return value?.replace(/\s+/g, "").trim() ?? "";
}

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim();
  return email ? email.toLowerCase() : null;
}

function normalizeMoney(value: number | undefined) {
  if (value === undefined || value === null) return 0;
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, "Tong chi tieu khong hop le");
  }

  return amount;
}

function validateCustomerBase(fullName: string, phone: string, email: string | null) {
  if (!fullName) {
    throw new ApiError(400, "Ten khach hang la bat buoc");
  }

  if (!phone) {
    throw new ApiError(400, "So dien thoai la bat buoc");
  }

  if (!/^[0-9+()-]{8,20}$/.test(phone)) {
    throw new ApiError(400, "So dien thoai khong hop le");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "Email khong hop le");
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
    throw new ApiError(404, "Khong tim thay khach hang");
  }

  return customer;
}

export async function createCustomerService(body: CreateCustomerBody) {
  const fullName = normalizeName(body.fullName);
  const phone = normalizePhone(body.phone);
  const email = normalizeEmail(body.email);

  validateCustomerBase(fullName, phone, email);

  const existingCustomer = await findCustomerByPhone(phone);

  if (existingCustomer) {
    throw new ApiError(409, "So dien thoai da ton tai");
  }

  return createCustomer({
    fullName,
    phone,
    email,
    totalSpent: normalizeMoney(body.totalSpent),
  });
}

export async function updateCustomerService(
  id: string,
  body: UpdateCustomerBody
) {
  const currentCustomer = await getCustomerService(id);
  const fullName = normalizeName(body.fullName);
  const phone = normalizePhone(body.phone);
  const email = normalizeEmail(body.email);

  validateCustomerBase(fullName, phone, email);

  const existingCustomer = await findCustomerByPhone(phone);

  if (existingCustomer && existingCustomer.id !== currentCustomer.id) {
    throw new ApiError(409, "So dien thoai da ton tai");
  }

  const updatedCustomer = await updateCustomer(id, {
    fullName,
    phone,
    email,
  });

  if (!updatedCustomer) {
    throw new ApiError(404, "Khong tim thay khach hang");
  }

  return updatedCustomer;
}

export async function deleteCustomerService(id: string) {
  const currentCustomer = await getCustomerService(id);
  const orderCount = await countOrdersByCustomerId(id);

  if (orderCount > 0) {
    throw new ApiError(
      409,
      "Khong the xoa khach hang da co hoa don. Hay giu lai de bao toan lich su ban hang."
    );
  }

  const deleted = await deleteCustomerById(id);

  if (!deleted) {
    throw new ApiError(404, "Khong tim thay khach hang");
  }

  return currentCustomer;
}

export async function getCustomerOrdersService(id: string) {
  await getCustomerService(id);
  return findCustomerOrders(id);
}
