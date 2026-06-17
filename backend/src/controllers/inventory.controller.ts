import type { Request, Response } from "express";
import {
  findAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  findAllMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  findAllGoodsReceipts,
  findGoodsReceiptDetail,
  findGoodsReceiptMaterialDetail,
  createGoodsReceiptTransaction,
  createStockAdjustmentTransaction,
} from "../repositories/inventory.repository";
import { ApiError } from "../utils/apiError";

function validateSupplierPhone(phone: unknown) {
  const normalizedPhone = String(phone || "").trim();

  if (!normalizedPhone) {
    throw new ApiError(400, "Vui lòng nhập số điện thoại nhà cung cấp.");
  }

  if (!/^\d{10}$/.test(normalizedPhone)) {
    throw new ApiError(400, "Số điện thoại nhà cung cấp phải gồm đúng 10 chữ số.");
  }
}

export async function getSuppliersController(req: Request, res: Response) {
  const data = await findAllSuppliers();
  return res.json({
    success: true,
    data,
  });
}

export async function createSupplierController(req: Request, res: Response) {
  const { name, phone } = req.body;

  if (!String(name || "").trim()) {
    throw new ApiError(400, "Vui lòng nhập tên nhà cung cấp.");
  }

  validateSupplierPhone(phone);

  const supplier = await createSupplier(req.body);

  return res.status(201).json({
    success: true,
    message: "Đã thêm nhà cung cấp mới.",
    data: supplier,
  });
}

export async function updateSupplierController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, phone } = req.body;

  if (!id || !id.trim()) {
    throw new ApiError(400, "Thiếu mã nhà cung cấp.");
  }

  if (!String(name || "").trim()) {
    throw new ApiError(400, "Vui lòng nhập tên nhà cung cấp.");
  }

  validateSupplierPhone(phone);

  const supplier = await updateSupplier(id, req.body);

  return res.json({
    success: true,
    message: "Đã cập nhật nhà cung cấp.",
    data: supplier,
  });
}

export async function deleteSupplierController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id || !id.trim()) {
    throw new ApiError(400, "Thiếu mã nhà cung cấp.");
  }

  const supplier = await deleteSupplier(id);

  return res.json({
    success: true,
    message: "Đã xóa nhà cung cấp.",
    data: supplier,
  });
}

export async function getMaterialsController(req: Request, res: Response) {
  const data = await findAllMaterials();
  return res.json({
    success: true,
    data,
  });
}

export async function createMaterialController(req: Request, res: Response) {
  const { name, unit } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, "Vui lòng nhập tên nguyên liệu.");
  }

  if (!unit || !unit.trim()) {
    throw new ApiError(400, "Vui lòng nhập đơn vị tính nguyên liệu.");
  }

  const material = await createMaterial(req.body);

  return res.status(201).json({
    success: true,
    message: "Đã thêm nguyên liệu mới.",
    data: material,
  });
}

export async function updateMaterialController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, unit } = req.body;

  if (!id || !id.trim()) {
    throw new ApiError(400, "Thiếu mã nguyên liệu");
  }

  if (!name || !name.trim()) {
    throw new ApiError(400, "Vui lòng nhập tên nguyên liệu");
  }

  if (!unit || !unit.trim()) {
    throw new ApiError(400, "Vui lòng nhập đơn vị tính nguyên liệu");
  }

  const material = await updateMaterial(id, req.body);

  return res.json({
    success: true,
    message: "Cập nhật nguyên liệu thành công",
    data: material,
  });
}

export async function deleteMaterialController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id || !id.trim()) {
    throw new ApiError(400, "Thiếu mã nguyên liệu");
  }

  const material = await deleteMaterial(id);

  return res.json({
    success: true,
    message: "Xóa nguyên liệu thành công",
    data: material,
  });
}

export async function getGoodsReceiptsController(req: Request, res: Response) {
  const receipts = await findAllGoodsReceipts();

  const data = [];
  for (const receipt of receipts) {
    const details = await findGoodsReceiptDetail(receipt.id);
    const materialDetails = await findGoodsReceiptMaterialDetail(receipt.id);
    data.push({
      ...receipt,
      details,
      materialDetails,
    });
  }

  return res.json({
    success: true,
    data,
  });
}

export async function createGoodsReceiptController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Phiên đăng nhập chưa được xác thực.");
  }

  const { materialItems } = req.body;

  if (!Array.isArray(materialItems) || materialItems.length === 0) {
    throw new ApiError(400, "Vui lòng chọn ít nhất một nguyên liệu để nhập kho.");
  }

  const receipt = await createGoodsReceiptTransaction(req.body, req.user.id);

  return res.status(201).json({
    success: true,
    message: "Đã tạo phiếu nhập kho.",
    data: receipt,
  });
}

export async function createStockAdjustmentController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Phiên đăng nhập chưa được xác thực.");
  }

  const { productId, newQuantity, note } = req.body;

  if (!productId || productId.trim() === "") {
    throw new ApiError(400, "Vui lòng chọn sản phẩm cần điều chỉnh.");
  }

  if (typeof newQuantity !== "number" || newQuantity < 0) {
    throw new ApiError(400, "Số lượng điều chỉnh không hợp lệ.");
  }

  const result = await createStockAdjustmentTransaction(
    productId,
    newQuantity,
    note,
    req.user.id
  );

  return res.status(200).json({
    success: true,
    message: "Đã điều chỉnh tồn kho.",
    data: result,
  });
}
