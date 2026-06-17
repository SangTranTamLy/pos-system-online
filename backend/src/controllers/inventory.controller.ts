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
    throw new ApiError(400, "Vui long nhap ten nha cung cap");
  }

  if (!phone || !phone.trim()) {
    throw new ApiError(400, "Vui long nhap so dien thoai nha cung cap");
  }

  const supplier = await createSupplier(req.body);

  return res.status(201).json({
    success: true,
    message: "Them nha cung cap thanh cong",
    data: supplier,
  });
}

export async function updateSupplierController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, phone } = req.body;

  if (!id || !id.trim()) {
    throw new ApiError(400, "Thieu ma nha cung cap");
  }

  if (!name || !name.trim()) {
    throw new ApiError(400, "Vui long nhap ten nha cung cap");
  }

  if (!phone || !phone.trim()) {
    throw new ApiError(400, "Vui long nhap so dien thoai nha cung cap");
  }

  const supplier = await updateSupplier(id, req.body);

  return res.json({
    success: true,
    message: "Cap nhat nha cung cap thanh cong",
    data: supplier,
  });
}

export async function deleteSupplierController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id || !id.trim()) {
    throw new ApiError(400, "Thieu ma nha cung cap");
  }

  const supplier = await deleteSupplier(id);

  return res.json({
    success: true,
    message: "Xoa nha cung cap thanh cong",
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
    throw new ApiError(400, "Vui long nhap ten nguyen lieu");
  }

  if (!unit || !unit.trim()) {
    throw new ApiError(400, "Vui long nhap don vi tinh nguyen lieu");
  }

  const material = await createMaterial(req.body);

  return res.status(201).json({
    success: true,
    message: "Them nguyen lieu thanh cong",
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
    throw new ApiError(401, "Chua xac thuc");
  }

  const { materialItems } = req.body;

  if (!Array.isArray(materialItems) || materialItems.length === 0) {
    throw new ApiError(400, "Vui long chon it nhat mot nguyen lieu de nhap kho");
  }

  const receipt = await createGoodsReceiptTransaction(req.body, req.user.id);

  return res.status(201).json({
    success: true,
    message: "Tao phieu nhap kho thanh cong",
    data: receipt,
  });
}

export async function createStockAdjustmentController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Chua xac thuc");
  }

  const { productId, newQuantity, note } = req.body;

  if (!productId || productId.trim() === "") {
    throw new ApiError(400, "Vui long chon san pham can dieu chinh");
  }

  if (typeof newQuantity !== "number" || newQuantity < 0) {
    throw new ApiError(400, "So luong dieu chinh khong hop le");
  }

  const result = await createStockAdjustmentTransaction(
    productId,
    newQuantity,
    note,
    req.user.id
  );

  return res.status(200).json({
    success: true,
    message: "Dieu chinh ton kho thanh cong",
    data: result,
  });
}
