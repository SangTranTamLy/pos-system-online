import type { Request, Response } from "express";
import {
  cancelOrderService,
  getOrderDetailService,
  getOrdersService,
} from "../services/order.service";
import { ApiError } from "../utils/apiError";

function getParamId(id: string | string[]) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getOrdersController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const query = { ...req.query };

  if (req.user.roleName.trim().toUpperCase() === "STAFF") {
    query.createdBy = req.user.id;
  }

  const orders = await getOrdersService(query);

  return res.json({
    success: true,
    message: "Lấy danh sách hóa đơn thành công",
    data: orders,
  });
}

export async function getOrderDetailController(req: Request, res: Response) {
  const order = await getOrderDetailService(getParamId(req.params.id));

  return res.json({
    success: true,
    message: "Lấy chi tiết hóa đơn thành công",
    data: order,
  });
}

export async function cancelOrderController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const bodyCancelledBy =
    typeof req.body?.cancelled_by === "string" ? req.body.cancelled_by.trim() : "";
  const cancelledBy = bodyCancelledBy || req.user.id;

  const order = await cancelOrderService(
    getParamId(req.params.id),
    cancelledBy,
    req.body
  );

  return res.json({
    success: true,
    message: "Hủy hóa đơn thành công",
    data: order,
  });
}