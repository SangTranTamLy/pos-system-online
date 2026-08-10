import type { Request, Response } from "express";
import {
  createCartCancellationService,
  createPosOrderService,
  createPosOrderSyncService,
  getPosProductConfigurationService,
} from "../services/pos.service";
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

export async function createPosOrderSyncController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  try {
    const result = await createPosOrderSyncService(req.body, req.user.id);
    return res.status(result.status === "SYNCED" ? 201 : 200).json({
      success: true,
      message:
        result.status === "ALREADY_SYNCED"
          ? "Đơn offline đã được đồng bộ trước đó"
          : "Đồng bộ đơn offline thành công",
      data: result,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    const normalizedMessage = error.message.toLocaleLowerCase("vi-VN");
    const status =
      normalizedMessage.includes("tồn kho") ||
      normalizedMessage.includes("stock")
        ? "CONFLICT_STOCK"
        : "REJECTED";

    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      data: {
        status,
        operationId:
          typeof req.body?.operationId === "string"
            ? req.body.operationId
            : null,
        localOrderId:
          typeof req.body?.localOrderId === "string"
            ? req.body.localOrderId
            : null,
      },
    });
  }
}

export async function getPosProductConfigurationController(
  req: Request,
  res: Response
) {
  const productId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const configuration = await getPosProductConfigurationService(productId);
  return res.status(200).json({
    success: true,
    data: configuration,
  });
}

export async function createCartCancellationController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa được xác thực");
  }

  const cancellation = await createCartCancellationService(req.body, req.user.id);
  return res.status(201).json({
    success: true,
    message: "Đã ghi nhận lý do hủy món",
    data: cancellation,
  });
}
