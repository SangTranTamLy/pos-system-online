import type { Request, Response } from "express";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2/promise";
import { ApiError } from "../utils/apiError";

type CustomerRow = RowDataPacket & {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  loyalty_points: number;
  total_spent: string;
};

function mapCustomer(row: CustomerRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    loyaltyPoints: row.loyalty_points,
    totalSpent: Number(row.total_spent),
  };
}

export async function searchCustomersController(req: Request, res: Response) {
  const query = req.query.q as string;

  if (!query?.trim()) {
    return res.status(200).json({
      success: true,
      message: "Tìm kiếm khách hàng",
      data: [],
    });
  }

  const trimmedQuery = query.trim();
  // Nếu nhập toàn số thì ưu tiên tìm theo số điện thoại để tích điểm nhanh tại quầy
  const isPhoneQuery = /^[0-9+\s]+$/.test(trimmedQuery);
  const phoneDigits = trimmedQuery.replace(/[\s+]/g, "");
  const searchTerm = `%${trimmedQuery}%`;

  const [rows] = await db.execute<CustomerRow[]>(
    isPhoneQuery
      ? `
      SELECT id, full_name, phone, email, loyalty_points, total_spent
      FROM customers
      WHERE phone LIKE ?
      ORDER BY (phone = ?) DESC, created_at DESC
      LIMIT 20
      `
      : `
      SELECT id, full_name, phone, email, loyalty_points, total_spent
      FROM customers
      WHERE full_name LIKE ? OR phone LIKE ? OR email LIKE ?
      ORDER BY created_at DESC
      LIMIT 20
      `,
    isPhoneQuery
      ? [`%${phoneDigits}%`, phoneDigits]
      : [searchTerm, searchTerm, searchTerm]
  );

  return res.status(200).json({
    success: true,
    message: "Danh sách khách hàng",
    data: rows.map(mapCustomer),
  });
}

export async function getCustomerController(req: Request, res: Response) {
  const { id } = req.params;

  const [rows] = await db.execute<CustomerRow[]>(
    `
    SELECT id, full_name, phone, email, loyalty_points, total_spent
    FROM customers
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  const customer = rows[0];

  if (!customer) {
    throw new ApiError(404, "Không tìm thấy khách hàng");
  }

  return res.status(200).json({
    success: true,
    message: "Chi tiết khách hàng",
    data: mapCustomer(customer),
  });
}
