import type { Request, Response } from "express";
import { createPosOrderService } from "../services/pos.service";
import { ApiError } from "../utils/apiError";

export async function createPosOrderController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const order = await createPosOrderService(req.body, req.user.id);

  return res.status(201).json({
    success: true,
    message: "Tạo đơn hàng POS thành công",
    data: order,
  });
}
