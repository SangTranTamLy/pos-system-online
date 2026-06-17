import type { Request, Response } from "express";
import {
  createCustomerService,
  deleteCustomerService,
  getCustomerOrdersService,
  getCustomerService,
  getCustomersService,
  searchCustomersService,
  updateCustomerService,
} from "../services/customer.service";

function getParamId(id: string | string[]) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getCustomersController(req: Request, res: Response) {
  const result = await getCustomersService({
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    limit: Number(req.query.limit ?? 100),
    offset: Number(req.query.offset ?? 0),
  });

  return res.status(200).json({
    success: true,
    message: "Đã tải danh sách khách hàng.",
    data: result.customers,
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
  });
}

export async function searchCustomersController(req: Request, res: Response) {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const customers = await searchCustomersService(query);

  return res.status(200).json({
    success: true,
    message: "Đã tìm kiếm khách hàng.",
    data: customers,
  });
}

export async function getCustomerController(req: Request, res: Response) {
  const customer = await getCustomerService(getParamId(req.params.id));

  return res.status(200).json({
    success: true,
    message: "Đã tải chi tiết khách hàng.",
    data: customer,
  });
}

export async function createCustomerController(req: Request, res: Response) {
  const customer = await createCustomerService(req.body);

  return res.status(201).json({
    success: true,
    message: "Đã tạo khách hàng mới.",
    data: customer,
  });
}

export async function updateCustomerController(req: Request, res: Response) {
  const customer = await updateCustomerService(getParamId(req.params.id), req.body);

  return res.status(200).json({
    success: true,
    message: "Đã cập nhật khách hàng.",
    data: customer,
  });
}

export async function deleteCustomerController(req: Request, res: Response) {
  const customer = await deleteCustomerService(getParamId(req.params.id));

  return res.status(200).json({
    success: true,
    message: "Đã xóa khách hàng.",
    data: customer,
  });
}

export async function getCustomerOrdersController(req: Request, res: Response) {
  const orders = await getCustomerOrdersService(getParamId(req.params.id));

  return res.status(200).json({
    success: true,
    message: "Đã tải lịch sử mua hàng của khách hàng.",
    data: orders,
  });
}
