import { randomUUID } from "crypto";
import type { ResultSetHeader } from "mysql2";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { db } from "../config/database";
import type {
  Customer,
  CustomerListQuery,
  CustomerOrderSummary,
} from "../types/customer.types";

type CustomerRow = RowDataPacket & {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  total_spent: string;
  order_count?: number | string;
  last_order_at?: Date | null;
  created_at: Date;
  updated_at: Date;
};

type PosCustomerRow = RowDataPacket & {
  id: string;
  total_spent: string;
};

type CustomerOrderRow = RowDataPacket & {
  id: string;
  status: string;
  final_amount: string;
  payment_method: string | null;
  created_at: Date;
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    address: row.address,
    totalSpent: Number(row.total_spent ?? 0),
    orderCount: Number(row.order_count ?? 0),
    lastOrderAt: toIso(row.last_order_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapCustomerOrder(row: CustomerOrderRow): CustomerOrderSummary {
  return {
    id: row.id,
    status: row.status,
    finalAmount: Number(row.final_amount ?? 0),
    paymentMethod: row.payment_method,
    createdAt: row.created_at.toISOString(),
  };
}

function clampLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return 100;
  return Math.trunc(Math.min(Math.max(Number(limit), 1), 200));
}

function clampOffset(offset: number | undefined) {
  if (!Number.isFinite(offset)) return 0;
  return Math.trunc(Math.max(Number(offset), 0));
}

function buildCustomerSearch(query: CustomerListQuery) {
  const search = query.q?.trim();

  if (!search) {
    return {
      whereClause: "",
      params: [] as Array<string | number>,
    };
  }

  const term = `%${search}%`;

  return {
    whereClause: "WHERE c.full_name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?",
    params: [term, term, term] as Array<string | number>,
  };
}

export async function findCustomers(
  query: CustomerListQuery = {}
): Promise<Customer[]> {
  const { whereClause, params } = buildCustomerSearch(query);
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);

  const [rows] = await db.execute<CustomerRow[]>(
    `
    SELECT
      c.id,
      c.full_name,
      c.phone,
      c.address,
      c.total_spent,
      COALESCE(o.order_count, 0) AS order_count,
      o.last_order_at,
      c.created_at,
      c.updated_at
    FROM customers c
    LEFT JOIN (
      SELECT
        customer_id,
        COUNT(*) AS order_count,
        MAX(created_at) AS last_order_at
      FROM orders
      WHERE customer_id IS NOT NULL
        AND status = 'completed'
      GROUP BY customer_id
    ) o ON o.customer_id = c.id
    ${whereClause}
    ORDER BY c.total_spent DESC, c.updated_at DESC, c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    params
  );

  return rows.map(mapCustomer);
}

export async function countCustomers(
  query: CustomerListQuery = {}
): Promise<number> {
  const { whereClause, params } = buildCustomerSearch(query);

  const [rows] = await db.execute<(RowDataPacket & { total: number })[]>(
    `
    SELECT COUNT(*) AS total
    FROM customers c
    ${whereClause}
    `,
    params
  );

  return Number(rows[0]?.total ?? 0);
}

export async function findCustomerProfileById(
  id: string
): Promise<Customer | null> {
  const [rows] = await db.execute<CustomerRow[]>(
    `
    SELECT
      c.id,
      c.full_name,
      c.phone,
      c.address,
      c.total_spent,
      COALESCE(o.order_count, 0) AS order_count,
      o.last_order_at,
      c.created_at,
      c.updated_at
    FROM customers c
    LEFT JOIN (
      SELECT
        customer_id,
        COUNT(*) AS order_count,
        MAX(created_at) AS last_order_at
      FROM orders
      WHERE customer_id IS NOT NULL
        AND status = 'completed'
      GROUP BY customer_id
    ) o ON o.customer_id = c.id
    WHERE c.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function findCustomerByPhone(
  phone: string
): Promise<Customer | null> {
  const [rows] = await db.execute<CustomerRow[]>(
    `
    SELECT
      c.id,
      c.full_name,
      c.phone,
      c.address,
      c.total_spent,
      COALESCE(o.order_count, 0) AS order_count,
      o.last_order_at,
      c.created_at,
      c.updated_at
    FROM customers c
    LEFT JOIN (
      SELECT
        customer_id,
        COUNT(*) AS order_count,
        MAX(created_at) AS last_order_at
      FROM orders
      WHERE customer_id IS NOT NULL
        AND status = 'completed'
      GROUP BY customer_id
    ) o ON o.customer_id = c.id
    WHERE c.phone = ?
    LIMIT 1
    `,
    [phone]
  );

  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function createCustomer(data: {
  fullName: string;
  phone: string;
  address: string | null;
  totalSpent: number;
}): Promise<Customer> {
  const id = randomUUID();

  await db.execute<ResultSetHeader>(
    `
    INSERT INTO customers (
      id,
      full_name,
      phone,
      address,
      total_spent
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      id,
      data.fullName,
      data.phone,
      data.address,
      data.totalSpent,
    ]
  );

  const customer = await findCustomerProfileById(id);

  if (!customer) {
    throw new Error("Create customer failed");
  }

  return customer;
}

export async function updateCustomer(
  id: string,
  data: {
    fullName: string;
    phone: string;
    address: string | null;
  }
): Promise<Customer | null> {
  await db.execute<ResultSetHeader>(
    `
    UPDATE customers
    SET full_name = ?, phone = ?, address = ?
    WHERE id = ?
    `,
    [data.fullName, data.phone, data.address, id]
  );

  return findCustomerProfileById(id);
}

export async function deleteCustomerById(id: string): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `
    DELETE FROM customers
    WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows > 0;
}

export async function countOrdersByCustomerId(id: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { total: number })[]>(
    `
    SELECT COUNT(*) AS total
    FROM orders
    WHERE customer_id = ?
    `,
    [id]
  );

  return Number(rows[0]?.total ?? 0);
}

export async function findCustomerOrders(
  customerId: string,
  limit = 50
): Promise<CustomerOrderSummary[]> {
  const [rows] = await db.execute<CustomerOrderRow[]>(
    `
    SELECT
      o.id,
      o.status,
      o.final_amount,
      p.payment_method,
      o.created_at
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
    LIMIT ${clampLimit(limit)}
    `,
    [customerId]
  );

  return rows.map(mapCustomerOrder);
}

export async function findCustomerById(
  connection: PoolConnection,
  customerId: string
): Promise<PosCustomerRow | null> {
  const [rows] = await connection.execute<PosCustomerRow[]>(
    `
    SELECT id, total_spent
    FROM customers
    WHERE id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [customerId]
  );

  return rows[0] ?? null;
}

export async function updateCustomerAfterOrder(
  connection: PoolConnection,
  customerId: string,
  finalAmount: number
): Promise<void> {
  try {
    await connection.execute(
      `
      UPDATE customers
      SET
        total_spent = total_spent + ?,
        order_count = order_count + 1,
        last_order_at = NOW()
      WHERE id = ?
      `,
      [finalAmount, customerId]
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }

    await connection.execute(
      `
      UPDATE customers
      SET total_spent = total_spent + ?
      WHERE id = ?
      `,
      [finalAmount, customerId]
    );
  }
}
