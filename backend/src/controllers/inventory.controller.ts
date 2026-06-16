import type { Request, Response } from "express";
import {
  findAllSuppliers,
  createSupplier,
  findAllGoodsReceipts,
  findGoodsReceiptDetail,
  createGoodsReceiptTransaction,
  createStockAdjustmentTransaction,
} from "../repositories/inventory.repository";
import { ApiError } from "../utils/apiError";

export async function getSuppliersController(req: Request, res: Response) {
  const data = await findAllSuppliers();
  return res.json({
    success: true,
    data,
  });
}

export async function createSupplierController(req: Request, res: Response) {
  const { name, phone } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, "Vui lòng nhập tên nhà cung cấp");
  }

  if (!phone || !phone.trim()) {
    throw new ApiError(400, "Vui lòng nhập số điện thoại nhà cung cấp");
  }

  const supplier = await createSupplier(req.body);

  return res.status(201).json({
    success: true,
    message: "Thêm nhà cung cấp thành công",
    data: supplier,
  });
}

export async function getGoodsReceiptsController(req: Request, res: Response) {
  const receipts = await findAllGoodsReceipts();

  const data = [];
  for (const r of receipts) {
    const details = await findGoodsReceiptDetail(r.id);
    data.push({
      ...r,
      details,
    });
  }

  return res.json({
    success: true,
    data,
  });
}

export async function createGoodsReceiptController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa xác thực");
  }

  const { items, note, totalAmount } = req.body;

  const hasItems = Array.isArray(items) && items.length > 0;
  const hasRawInput = note && note.trim() !== "" && typeof totalAmount === "number" && totalAmount >= 0;

  if (!hasItems && !hasRawInput) {
    throw new ApiError(
      400,
      "Vui lòng chọn ít nhất một sản phẩm để nhập kho hoặc điền thông tin chi tiết và tổng tiền để ghi nhận"
    );
  }

  const receipt = await createGoodsReceiptTransaction(req.body, req.user.id);

  return res.status(201).json({
    success: true,
    message: "Tạo phiếu nhập kho thành công",
    data: receipt,
  });
}

export async function createStockAdjustmentController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chưa xác thực");
  }

  const { productId, newQuantity, note } = req.body;

  if (!productId || productId.trim() === "") {
    throw new ApiError(400, "Vui lòng chọn sản phẩm cần điều chỉnh");
  }

  if (typeof newQuantity !== "number" || newQuantity < 0) {
    throw new ApiError(400, "Số lượng điều chỉnh không hợp lệ (phải là số >= 0)");
  }

  const result = await createStockAdjustmentTransaction(
    productId,
    newQuantity,
    note,
    req.user.id
  );

  return res.status(200).json({
    success: true,
    message: "Điều chỉnh tồn kho thành công",
    data: result,
  });
}
