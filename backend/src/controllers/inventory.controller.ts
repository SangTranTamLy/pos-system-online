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
  findAllInventoryAudits,
  findInventoryAuditById,
  createInventoryAudit,
  updateInventoryAudit,
  deleteInventoryAudit,
  payGoodsReceiptDebt,
} from "../repositories/inventory.repository";
import { ApiError } from "../utils/apiError";
import { createAuditLog } from "../repositories/audit-log.repository";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2/promise";

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

  const userId = (req as any).user?.id;
  if (userId && supplier) {
    void createAuditLog(
      userId,
      "SUA_NHA_CUNG_CAP",
      `NCC: ${supplier.name}`,
      `Thêm nhà cung cấp mới: ${supplier.name} (SĐT: ${supplier.phone}).`,
      null,
      supplier
    );
  }

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

  // Lấy dữ liệu cũ để ghi log JSON
  let oldSupplier = null;
  try {
    const [rows]: any = await db.query("SELECT * FROM suppliers WHERE id = ?", [id]);
    oldSupplier = rows[0] || null;
  } catch (err) {
    console.error("Lỗi khi lấy thông tin nhà cung cấp cũ:", err);
  }

  const supplier = await updateSupplier(id, req.body);

  const userId = (req as any).user?.id;
  if (userId && supplier) {
    void createAuditLog(
      userId,
      "SUA_NHA_CUNG_CAP",
      `NCC: ${supplier.name}`,
      `Cập nhật nhà cung cấp: ${supplier.name} (SĐT: ${supplier.phone}).`,
      oldSupplier,
      supplier
    );
  }

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

  const userId = (req as any).user?.id;
  if (userId && supplier) {
    void createAuditLog(
      userId,
      "SUA_NHA_CUNG_CAP",
      `NCC: ${supplier.name}`,
      `Xóa nhà cung cấp: ${supplier.name} (SĐT: ${supplier.phone || "Không có"}).`,
      supplier,
      null
    );
  }

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

  const userId = (req as any).user?.id;
  if (userId && material) {
    void createAuditLog(
      userId,
      "SUA_NGUYEN_LIEU",
      `Nguyên liệu: ${material.name}`,
      `Thêm nguyên liệu mới: ${material.name} (ĐVT: ${material.unit}).`,
      null,
      material
    );
  }

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

  // Lấy dữ liệu cũ để ghi log JSON
  let oldMaterial = null;
  try {
    const [rows]: any = await db.query("SELECT * FROM raw_materials WHERE id = ?", [id]);
    oldMaterial = rows[0] || null;
  } catch (err) {
    console.error("Lỗi khi lấy thông tin nguyên liệu cũ:", err);
  }

  const material = await updateMaterial(id, req.body);

  const userId = (req as any).user?.id;
  if (userId && material) {
    void createAuditLog(
      userId,
      "SUA_NGUYEN_LIEU",
      `Nguyên liệu: ${material.name}`,
      `Cập nhật nguyên liệu: ${material.name} (ĐVT: ${material.unit}).`,
      oldMaterial,
      material
    );
  }

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

  const userId = (req as any).user?.id;
  if (userId && material) {
    void createAuditLog(
      userId,
      "SUA_NGUYEN_LIEU",
      `Nguyên liệu: ${material.name}`,
      `Xóa nguyên liệu thô: ${material.name} (ĐVT: ${material.unit || "Không rõ"}).`,
      material,
      null
    );
  }

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

export async function payGoodsReceiptDebtController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Phiên đăng nhập chưa được xác thực.");
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { amount } = req.body;

  if (!id || id.trim() === "") {
    throw new ApiError(400, "Thiếu mã phiếu nhập kho.");
  }

  const payAmount = Number(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    throw new ApiError(400, "Số tiền thanh toán không hợp lệ.");
  }

  await payGoodsReceiptDebt(id, payAmount);

  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT r.note, r.total_amount, s.name AS supplierName FROM goods_receipts r LEFT JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = ? LIMIT 1",
    [id]
  );
  const receipt = rows[0];
  const supplierName = receipt?.supplierName || "Không rõ";

  void createAuditLog(
    req.user.id,
    "SUA_KHO",
    `Thanh toán nợ: PN-${id.slice(0, 8).toUpperCase()}`,
    `Thanh toán thêm ${payAmount.toLocaleString("vi-VN")} VND nợ cho nhà cung cấp ${supplierName}.`,
    { receiptId: id, payAmount },
    null
  );

  return res.json({
    success: true,
    message: "Thanh toán công nợ thành công.",
  });
}

export async function getInventoryAuditsController(req: Request, res: Response) {
  const data = await findAllInventoryAudits();
  return res.json({
    success: true,
    data,
  });
}

export async function getInventoryAuditByIdController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !id.trim()) {
    throw new ApiError(400, "Thiếu mã phiếu kiểm kê.");
  }
  const audit = await findInventoryAuditById(id);
  if (!audit) {
    throw new ApiError(404, "Không tìm thấy phiếu kiểm kê.");
  }
  return res.json({
    success: true,
    data: audit,
  });
}

export async function createInventoryAuditController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Phiên đăng nhập chưa được xác thực.");
  }

  const { status, note, items } = req.body;

  if (status !== "draft" && status !== "completed") {
    throw new ApiError(400, "Trạng thái phiếu kiểm kê không hợp lệ.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Vui lòng chọn ít nhất một nguyên liệu để kiểm kê.");
  }

  const audit = await createInventoryAudit(req.body, req.user.id);

  return res.status(201).json({
    success: true,
    message: status === "completed" ? "Đã hoàn thành và cân bằng kho." : "Đã lưu phiếu kiểm kê nháp.",
    data: audit,
  });
}

export async function updateInventoryAuditController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Phiên đăng nhập chưa được xác thực.");
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !id.trim()) {
    throw new ApiError(400, "Thiếu mã phiếu kiểm kê.");
  }

  const { status, note, items } = req.body;

  if (status !== "draft" && status !== "completed") {
    throw new ApiError(400, "Trạng thái phiếu kiểm kê không hợp lệ.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Vui lòng chọn ít nhất một nguyên liệu để kiểm kê.");
  }

  const audit = await updateInventoryAudit(id, req.body, req.user.id);

  return res.json({
    success: true,
    message: status === "completed" ? "Đã hoàn thành và cân bằng kho." : "Đã cập nhật phiếu kiểm kê nháp.",
    data: audit,
  });
}

export async function deleteInventoryAuditController(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !id.trim()) {
    throw new ApiError(400, "Thiếu mã phiếu kiểm kê.");
  }

  await deleteInventoryAudit(id);

  return res.json({
    success: true,
    message: "Đã xóa phiếu kiểm kê nháp.",
  });
}
