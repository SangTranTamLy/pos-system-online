import { randomUUID } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { db } from "../config/database";
import type {
  Supplier,
  CreateSupplierBody,
  UpdateSupplierBody,
  Material,
  CreateMaterialBody,
  UpdateMaterialBody,
  CreateGoodsReceiptBody,
  GoodsReceipt,
  GoodsReceiptDetail,
  GoodsReceiptMaterialDetail,
  InventoryAudit,
  InventoryAuditDetail,
  CreateInventoryAuditBody,
  UpdateInventoryAuditBody,
} from "../types/inventory.types";
import { ApiError } from "../utils/apiError";

type SupplierRow = RowDataPacket & Supplier;
type MaterialRow = RowDataPacket & Material;
type GoodsReceiptRow = RowDataPacket & GoodsReceipt;
type GoodsReceiptDetailRow = RowDataPacket & GoodsReceiptDetail;
type GoodsReceiptMaterialDetailRow = RowDataPacket & GoodsReceiptMaterialDetail;

type SupplierDbRow = SupplierRow & {
  contact_name?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

function mapSupplier(row: SupplierDbRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName ?? row.contact_name ?? null,
    phone: row.phone,
    email: row.email ?? null,
    address: row.address ?? null,
    createdAt: row.createdAt ?? row.created_at ?? new Date(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date(),
  };
}

function normalizeSupplierInput(data: CreateSupplierBody | UpdateSupplierBody) {
  const name = String(data.name || "").trim();
  const contactName = String(data.contactName || "").trim();
  const phone = String(data.phone || "").trim();
  const email = String(data.email || "").trim();
  const address = String(data.address || "").trim();

  if (!name) {
    throw new ApiError(400, "Vui lòng nhập tên nhà cung cấp.");
  }

  if (!phone) {
    throw new ApiError(400, "Vui lòng nhập số điện thoại nhà cung cấp.");
  }

  if (name.length > 160) {
    throw new ApiError(400, "Tên nhà cung cấp không được vượt quá 160 ký tự.");
  }

  if (contactName.length > 120) {
    throw new ApiError(400, "Người liên hệ không được vượt quá 120 ký tự.");
  }

  if (phone.length > 30) {
    throw new ApiError(400, "Số điện thoại không được vượt quá 30 ký tự.");
  }

  if (email.length > 255) {
    throw new ApiError(400, "Email không được vượt quá 255 ký tự.");
  }

  return {
    name,
    contactName: contactName || null,
    phone,
    email: email || null,
    address: address || null,
  };
}

export async function findAllSuppliers(): Promise<Supplier[]> {
  const [rows] = await db.execute<SupplierRow[]>(
    "SELECT * FROM suppliers ORDER BY name ASC"
  );
  return rows.map((row) => mapSupplier(row));
}

export async function createSupplier(
  data: CreateSupplierBody
): Promise<Supplier> {
  const supplierData = normalizeSupplierInput(data);
  const id = randomUUID();
  await db.execute(
    `
    INSERT INTO suppliers (id, name, contact_name, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      supplierData.name,
      supplierData.contactName,
      supplierData.phone,
      supplierData.email,
      supplierData.address,
    ]
  );

  const [rows] = await db.execute<SupplierRow[]>(
    "SELECT * FROM suppliers WHERE id = ? LIMIT 1",
    [id]
  );

  if (!rows[0]) {
    throw new ApiError(500, "Không tạo được nhà cung cấp");
  }

  return mapSupplier(rows[0]);
}

export async function updateSupplier(
  id: string,
  data: UpdateSupplierBody
): Promise<Supplier> {
  const supplierData = normalizeSupplierInput(data);
  const [result] = await db.execute<ResultSetHeader>(
    `
    UPDATE suppliers
    SET name = ?, contact_name = ?, phone = ?, email = ?, address = ?
    WHERE id = ?
    `,
    [
      supplierData.name,
      supplierData.contactName,
      supplierData.phone,
      supplierData.email,
      supplierData.address,
      id,
    ]
  );

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Không tìm thấy nhà cung cấp");
  }

  const [rows] = await db.execute<SupplierRow[]>(
    "SELECT * FROM suppliers WHERE id = ? LIMIT 1",
    [id]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Không tìm thấy nhà cung cấp");
  }

  return mapSupplier(rows[0]);
}

export async function deleteSupplier(id: string): Promise<Supplier> {
  const [rows] = await db.execute<SupplierRow[]>(
    "SELECT * FROM suppliers WHERE id = ? LIMIT 1",
    [id]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Không tìm thấy nhà cung cấp");
  }

  const supplier = mapSupplier(rows[0]);
  
  // Set supplier_id of materials referencing this supplier to NULL to prevent orphan rows or errors
  await db.execute("UPDATE raw_materials SET supplier_id = NULL WHERE supplier_id = ?", [id]);
  await db.execute("DELETE FROM suppliers WHERE id = ?", [id]);

  return supplier;
}

function mapMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category ?? "Khac",
    unit: row.unit,
    supplierId: row.supplierId ?? row.supplier_id ?? null,
    supplierName: row.supplierName ?? row.supplier_name ?? null,
    stockQuantity: Number(row.stockQuantity ?? row.stock_quantity ?? 0),
    importPrice: Number(row.importPrice ?? row.import_price ?? 0),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  } as Material;
}

async function resolveMaterialSupplierId(
  supplierId?: string | null
): Promise<string | null> {
  if (!supplierId) {
    return null;
  }

  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM suppliers WHERE id = ? LIMIT 1",
    [supplierId]
  );

  if (!rows[0]) {
    // Gracefully handle deleted/orphaned supplier references by clearing them
    return null;
  }

  return supplierId;
}

async function ensureMaterialSkuAvailable(sku: string, ignoreId?: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT id
    FROM raw_materials
    WHERE sku = ?
      AND (? IS NULL OR id <> ?)
    LIMIT 1
    `,
    [sku, ignoreId ?? null, ignoreId ?? null]
  );

  if (rows[0]) {
    throw new ApiError(409, "Mã nguyên liệu đã tồn tại.");
  }
}

export async function findAllMaterials(): Promise<Material[]> {
  const [rows] = await db.execute<MaterialRow[]>(
    `
    SELECT
      raw_materials.id,
      raw_materials.name,
      raw_materials.sku,
      raw_materials.category,
      raw_materials.unit,
      raw_materials.supplier_id AS supplierId,
      suppliers.name AS supplierName,
      stock_quantity AS stockQuantity,
      import_price AS importPrice,
      is_active AS isActive,
      raw_materials.created_at AS createdAt,
      raw_materials.updated_at AS updatedAt
    FROM raw_materials
    LEFT JOIN suppliers ON suppliers.id = raw_materials.supplier_id
    ORDER BY name ASC
    `
  );

  return rows.map(mapMaterial);
}

export async function createMaterial(data: CreateMaterialBody): Promise<Material> {
  const id = randomUUID();
  const sku =
    data.sku?.trim() ||
    `NL-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
  const supplierId = await resolveMaterialSupplierId(data.supplierId);
  await ensureMaterialSkuAvailable(sku);

  await db.execute(
    `
    INSERT INTO raw_materials (id, name, sku, category, unit, supplier_id, stock_quantity, import_price, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.name.trim(),
      sku,
      data.category?.trim() || "Khac",
      data.unit.trim(),
      supplierId,
      Number(data.stockQuantity ?? 0),
      Number(data.importPrice ?? 0),
      data.isActive ?? true,
    ]
  );

  const [rows] = await db.execute<MaterialRow[]>(
    `
    SELECT
      raw_materials.id,
      raw_materials.name,
      raw_materials.sku,
      raw_materials.category,
      raw_materials.unit,
      raw_materials.supplier_id AS supplierId,
      suppliers.name AS supplierName,
      stock_quantity AS stockQuantity,
      import_price AS importPrice,
      is_active AS isActive,
      raw_materials.created_at AS createdAt,
      raw_materials.updated_at AS updatedAt
    FROM raw_materials
    LEFT JOIN suppliers ON suppliers.id = raw_materials.supplier_id
    WHERE raw_materials.id = ?
    LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    throw new ApiError(500, "Không tạo được nguyên liệu.");
  }

  return mapMaterial(rows[0]);
}

export async function updateMaterial(
  id: string,
  data: UpdateMaterialBody
): Promise<Material> {
  const sku = data.sku?.trim();
  if (!sku) {
    throw new ApiError(400, "Vui lòng nhập mã nguyên liệu.");
  }

  const supplierId = await resolveMaterialSupplierId(data.supplierId);
  await ensureMaterialSkuAvailable(sku, id);

  const [result] = await db.execute<ResultSetHeader>(
    `
    UPDATE raw_materials
    SET name = ?, sku = ?, category = ?, unit = ?, supplier_id = ?, import_price = ?, is_active = ?
    WHERE id = ?
    `,
    [
      data.name.trim(),
      sku,
      data.category?.trim() || "Khac",
      data.unit.trim(),
      supplierId,
      Number(data.importPrice ?? 0),
      data.isActive ?? true,
      id,
    ]
  );

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Không tìm thấy nguyên liệu");
  }

  const [rows] = await db.execute<MaterialRow[]>(
    `
    SELECT
      raw_materials.id,
      raw_materials.name,
      raw_materials.sku,
      raw_materials.category,
      raw_materials.unit,
      raw_materials.supplier_id AS supplierId,
      suppliers.name AS supplierName,
      stock_quantity AS stockQuantity,
      import_price AS importPrice,
      is_active AS isActive,
      raw_materials.created_at AS createdAt,
      raw_materials.updated_at AS updatedAt
    FROM raw_materials
    LEFT JOIN suppliers ON suppliers.id = raw_materials.supplier_id
    WHERE raw_materials.id = ?
    LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Không tìm thấy nguyên liệu");
  }

  return mapMaterial(rows[0]);
}

export async function deleteMaterial(id: string): Promise<Material> {
  const [rows] = await db.execute<MaterialRow[]>(
    `
    SELECT
      raw_materials.id,
      raw_materials.name,
      raw_materials.sku,
      raw_materials.category,
      raw_materials.unit,
      raw_materials.supplier_id AS supplierId,
      suppliers.name AS supplierName,
      stock_quantity AS stockQuantity,
      import_price AS importPrice,
      is_active AS isActive,
      raw_materials.created_at AS createdAt,
      raw_materials.updated_at AS updatedAt
    FROM raw_materials
    LEFT JOIN suppliers ON suppliers.id = raw_materials.supplier_id
    WHERE raw_materials.id = ?
    LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Không tìm thấy nguyên liệu");
  }

  const material = mapMaterial(rows[0]);
  try {
    await db.execute("DELETE FROM raw_materials WHERE id = ?", [id]);
  } catch (error: any) {
    // Catch foreign key constraint violation (ER_ROW_IS_REFERENCED / 1451)
    if (error.errno === 1451 || error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      throw new ApiError(400, "Không thể xóa nguyên liệu này vì đã có lịch sử nhập kho liên quan. Vui lòng chuyển trạng thái hoạt động sang Vô hiệu hóa thay vì xóa.");
    }
    throw error;
  }

  return material;
}

export async function findAllGoodsReceipts(): Promise<GoodsReceipt[]> {
  const [receiptRows] = await db.execute<GoodsReceiptRow[]>(
    `
    SELECT
      goods_receipts.id,
      goods_receipts.supplier_id AS supplierId,
      suppliers.name AS supplierName,
      goods_receipts.created_by AS createdBy,
      users.full_name AS createdByName,
      goods_receipts.note,
      goods_receipts.total_amount AS totalAmount,
      goods_receipts.created_at AS createdAt
    FROM goods_receipts
    LEFT JOIN suppliers ON suppliers.id = goods_receipts.supplier_id
    LEFT JOIN users ON users.id = goods_receipts.created_by
    ORDER BY goods_receipts.created_at DESC
    `
  );

  return receiptRows;
}

export async function findGoodsReceiptDetail(
  receiptId: string
): Promise<GoodsReceiptDetail[]> {
  const [rows] = await db.execute<GoodsReceiptDetailRow[]>(
    `
    SELECT
      goods_receipt_details.id,
      goods_receipt_details.receipt_id AS receiptId,
      goods_receipt_details.product_id AS productId,
      products.name AS productName,
      goods_receipt_details.quantity,
      goods_receipt_details.unit_price AS unitPrice,
      goods_receipt_details.line_total AS lineTotal
    FROM goods_receipt_details
    JOIN products ON products.id = goods_receipt_details.product_id
    WHERE goods_receipt_details.receipt_id = ?
    `,
    [receiptId]
  );
  return rows;
}

export async function findGoodsReceiptMaterialDetail(
  receiptId: string
): Promise<GoodsReceiptMaterialDetail[]> {
  const [rows] = await db.execute<GoodsReceiptMaterialDetailRow[]>(
    `
    SELECT
      goods_receipt_material_details.id,
      goods_receipt_material_details.receipt_id AS receiptId,
      goods_receipt_material_details.material_id AS materialId,
      raw_materials.name AS materialName,
      raw_materials.unit,
      goods_receipt_material_details.quantity,
      goods_receipt_material_details.unit_price AS unitPrice,
      goods_receipt_material_details.line_total AS lineTotal
    FROM goods_receipt_material_details
    JOIN raw_materials ON raw_materials.id = goods_receipt_material_details.material_id
    WHERE goods_receipt_material_details.receipt_id = ?
    `,
    [receiptId]
  );

  return rows;
}

export async function createGoodsReceiptTransaction(
  data: CreateGoodsReceiptBody,
  createdBy: string
): Promise<GoodsReceipt> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Verify supplier if supplierId is provided
    if (data.supplierId) {
      const [suppliers] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM suppliers WHERE id = ? LIMIT 1",
        [data.supplierId]
      );
      if (suppliers.length === 0) {
        throw new ApiError(404, "Không tìm thấy nhà cung cấp");
      }
    }

    const [creatorRows] = await connection.execute<RowDataPacket[]>(
      "SELECT id, full_name FROM users WHERE id = ? LIMIT 1",
      [createdBy]
    );
    const creator = creatorRows[0] || null;
    const receiptCreatedBy = creator?.id || null;
    const createdByName = creator?.full_name || null;

    const receiptId = randomUUID();
    let totalAmount = 0;
    const materialDetailsList: GoodsReceiptMaterialDetail[] = [];

    if (!Array.isArray(data.materialItems) || data.materialItems.length === 0) {
      throw new ApiError(400, "Vui lòng chọn ít nhất một nguyên liệu nhập kho.");
    }

    for (const item of data.materialItems) {
      const materialId = item.materialId.trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      if (!materialId || quantity <= 0 || unitPrice < 0) {
        throw new ApiError(400, "Thông tin nguyên liệu nhập kho không hợp lệ.");
      }

      const [materials] = await connection.execute<RowDataPacket[]>(
        "SELECT id, name, unit FROM raw_materials WHERE id = ? AND is_active = TRUE LIMIT 1",
        [materialId]
      );

      const material = materials[0];
      if (!material) {
        throw new ApiError(404, `Không tìm thấy nguyên liệu với ID ${materialId}.`);
      }

      const lineTotal = quantity * unitPrice;
      totalAmount += lineTotal;
      const detailId = randomUUID();

      materialDetailsList.push({
        id: detailId,
        receiptId,
        materialId,
        materialName: material.name,
        unit: material.unit,
        quantity,
        unitPrice,
        lineTotal,
      });
    }
    const receiptDate = data.createdAt ? new Date(data.createdAt) : new Date();

    // 4. Create goods receipt header
    await connection.execute(
      `
      INSERT INTO goods_receipts (id, supplier_id, created_by, note, total_amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        receiptId,
        data.supplierId || null,
        receiptCreatedBy,
        data.note?.trim() || null,
        totalAmount,
        receiptDate,
      ]
    );

    for (const detail of materialDetailsList) {
      await connection.execute(
        `
        INSERT INTO goods_receipt_material_details (id, receipt_id, material_id, quantity, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          detail.id,
          detail.receiptId,
          detail.materialId,
          detail.quantity,
          detail.unitPrice,
          detail.lineTotal,
        ]
      );

      // Cập nhật tồn kho và giá nhập mới cho nguyên liệu
      await connection.execute(
        `
        UPDATE raw_materials
        SET stock_quantity = stock_quantity + ?,
            import_price = ?
        WHERE id = ?
        `,
        [detail.quantity, detail.unitPrice, detail.materialId]
      );
    }

    await connection.commit();

    // Get supplier name
    let supplierName = null;
    if (data.supplierId) {
      const [sups] = await connection.execute<RowDataPacket[]>(
        "SELECT name FROM suppliers WHERE id = ? LIMIT 1",
        [data.supplierId]
      );
      supplierName = sups[0]?.name || null;
    }

    // Log goods receipt
    try {
      const [userRows] = await connection.execute<RowDataPacket[]>(
        `SELECT u.full_name, r.name AS role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ? 
         LIMIT 1`,
        [createdBy]
      );

      const userFullName = userRows[0]?.full_name || "Nhân viên";
      const rawRole = userRows[0]?.role_name || "staff";
      const userRole = rawRole.trim().toLowerCase() === "admin" || rawRole.trim().toLowerCase() === "manager" ? "QL" : "TN";

      let descriptionText = `Nhập kho nguyên liệu. Tổng giá trị: ${totalAmount.toLocaleString("vi-VN")}đ. Chi tiết: `;
      const detailStrings = materialDetailsList.map(d => `${d.materialName} (${d.quantity} ${d.unit})`);
      descriptionText += detailStrings.join(", ");

      await connection.execute(
        `
        INSERT INTO audit_logs (id, user_id, user_name, role, action_type, target_object, description)
        VALUES (?, ?, ?, ?, 'SUA_KHO', ?, ?)
        `,
        [
          randomUUID(),
          createdBy,
          userFullName,
          userRole,
          supplierName || "Nhà cung cấp",
          descriptionText
        ]
      );
    } catch (logErr) {
      console.error("Error creating audit log for goods receipt:", logErr);
    }

    return {
      id: receiptId,
      supplierId: data.supplierId || null,
      supplierName,
      createdBy: receiptCreatedBy,
      createdByName,
      note: data.note?.trim() || null,
      totalAmount,
      createdAt: new Date(),
      details: [],
      materialDetails: materialDetailsList,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createStockAdjustmentTransaction(
  productId: string,
  newQuantity: number,
  note: string,
  createdBy: string
): Promise<any> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [products] = await connection.execute<RowDataPacket[]>(
      "SELECT id, name, stock_quantity, status, is_tracked_stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [productId]
    );

    const product = products[0];
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    if (!product.is_tracked_stock) {
      throw new ApiError(400, "Sản phẩm tự chế biến không quản lý kho, không thể điều chỉnh tồn kho.");
    }

    const oldQuantity = Number(product.stock_quantity);
    const qtyDiff = newQuantity - oldQuantity;

    // Update stock quantity and status
    await connection.execute(
      `
      UPDATE products
      SET
        stock_quantity = ?,
        status = CASE
          WHEN ? <= 0 THEN 'out_of_stock'
          WHEN status = 'out_of_stock' AND ? > 0 THEN 'active'
          ELSE status
        END
      WHERE id = ?
      `,
      [newQuantity, newQuantity, newQuantity, productId]
    );

    // If there is a change, log it in stock_transactions
    if (qtyDiff !== 0) {
      const transactionId = randomUUID();
      const direction = qtyDiff > 0 ? "tăng" : "giảm";
      const displayDiff = Math.abs(qtyDiff);
      const defaultNote = `Điều chỉnh ${direction} từ ${oldQuantity} thành ${newQuantity} (${note || "Kiểm kho"})`;

      await connection.execute(
        `
        INSERT INTO stock_transactions (id, product_id, created_by, transaction_type, quantity, note)
        VALUES (?, ?, ?, 'adjustment', ?, ?)
        `,
        [transactionId, productId, createdBy, displayDiff, defaultNote]
      );
    }

    await connection.commit();

    // Log stock adjustment
    try {
      const [userRows] = await connection.execute<RowDataPacket[]>(
        `SELECT u.full_name, r.name AS role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ? 
         LIMIT 1`,
        [createdBy]
      );

      const userFullName = userRows[0]?.full_name || "Nhân viên";
      const rawRole = userRows[0]?.role_name || "staff";
      const userRole = rawRole.trim().toLowerCase() === "admin" || rawRole.trim().toLowerCase() === "manager" ? "QL" : "TN";
      const direction = qtyDiff > 0 ? "tăng" : "giảm";

      await connection.execute(
        `
        INSERT INTO audit_logs (id, user_id, user_name, role, action_type, target_object, description)
        VALUES (?, ?, ?, ?, 'SUA_KHO', ?, ?)
        `,
        [
          randomUUID(),
          createdBy,
          userFullName,
          userRole,
          `Sản phẩm: ${product.name}`,
          `Điều chỉnh kho: ${direction} từ ${oldQuantity} thành ${newQuantity}. Lý do: ${note || "Kiểm kho"}.`
        ]
      );
    } catch (logErr) {
      console.error("Lỗi tạo nhật ký kiểm tra cho việc điều chỉnh tồn kho:", logErr);
    }

    return {
      productId,
      name: product.name,
      oldQuantity,
      newQuantity,
      qtyDiff,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findAllInventoryAudits(): Promise<InventoryAudit[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      ia.id,
      ia.created_by AS createdBy,
      u.full_name AS createdByName,
      ia.status,
      ia.note,
      ia.created_at AS createdAt,
      ia.updated_at AS updatedAt
    FROM inventory_audits ia
    LEFT JOIN users u ON u.id = ia.created_by
    ORDER BY ia.created_at DESC
    `
  );
  return rows.map((row) => ({
    id: row.id,
    createdBy: row.createdBy,
    createdByName: row.createdByName ?? null,
    status: row.status as "draft" | "completed",
    note: row.note ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function findInventoryAuditById(id: string): Promise<InventoryAudit | null> {
  const [auditRows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      ia.id,
      ia.created_by AS createdBy,
      u.full_name AS createdByName,
      ia.status,
      ia.note,
      ia.created_at AS createdAt,
      ia.updated_at AS updatedAt
    FROM inventory_audits ia
    LEFT JOIN users u ON u.id = ia.created_by
    WHERE ia.id = ?
    LIMIT 1
    `,
    [id]
  );

  const auditRow = auditRows[0];
  if (!auditRow) {
    return null;
  }

  const [detailRows] = await db.execute<RowDataPacket[]>(
    `
    SELECT
      iad.id,
      iad.audit_id AS auditId,
      iad.material_id AS materialId,
      m.name AS materialName,
      m.sku,
      m.category,
      m.unit,
      iad.system_quantity AS systemQuantity,
      iad.actual_quantity AS actualQuantity,
      iad.variance,
      iad.note
    FROM inventory_audit_details iad
    JOIN raw_materials m ON m.id = iad.material_id
    WHERE iad.audit_id = ?
    `,
    [id]
  );

  const details = detailRows.map((row) => ({
    id: row.id,
    auditId: row.auditId,
    materialId: row.materialId,
    materialName: row.materialName,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    systemQuantity: Number(row.systemQuantity),
    actualQuantity: Number(row.actualQuantity),
    variance: Number(row.variance),
    note: row.note ?? null,
  }));

  return {
    id: auditRow.id,
    createdBy: auditRow.createdBy,
    createdByName: auditRow.createdByName ?? null,
    status: auditRow.status as "draft" | "completed",
    note: auditRow.note ?? null,
    createdAt: auditRow.createdAt,
    updatedAt: auditRow.updatedAt,
    details,
  };
}

export async function createInventoryAudit(
  data: CreateInventoryAuditBody,
  createdBy: string
): Promise<InventoryAudit> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const auditId = randomUUID();
    const note = data.note?.trim() || null;
    const status = data.status || "draft";

    if (status !== "draft" && status !== "completed") {
      throw new ApiError(400, "Trạng thái phiếu kiểm kê không hợp lệ.");
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new ApiError(400, "Vui lòng chọn ít nhất một nguyên liệu để kiểm kê.");
    }

    // 1. Insert header
    await connection.execute(
      `
      INSERT INTO inventory_audits (id, created_by, status, note)
      VALUES (?, ?, ?, ?)
      `,
      [auditId, createdBy, status, note]
    );

    const detailsList: InventoryAuditDetail[] = [];
    const updatedMaterialsLog: { name: string; oldQty: number; newQty: number }[] = [];

    for (const item of data.items) {
      const materialId = item.materialId.trim();
      const systemQuantity = Number(item.systemQuantity);
      const actualQuantity = Number(item.actualQuantity);
      const itemNote = item.note?.trim() || null;

      if (!materialId || isNaN(systemQuantity) || isNaN(actualQuantity)) {
        throw new ApiError(400, "Thông tin chi tiết kiểm kê không hợp lệ.");
      }

      // Lock material row if we're completing, and get its current database values
      let mRows: RowDataPacket[];
      if (status === "completed") {
        [mRows] = await connection.execute<RowDataPacket[]>(
          "SELECT id, name, stock_quantity, is_active FROM raw_materials WHERE id = ? LIMIT 1 FOR UPDATE",
          [materialId]
        );
      } else {
        [mRows] = await connection.execute<RowDataPacket[]>(
          "SELECT id, name, stock_quantity, is_active FROM raw_materials WHERE id = ? LIMIT 1",
          [materialId]
        );
      }

      const material = mRows[0];
      if (!material) {
        throw new ApiError(404, `Không tìm thấy nguyên liệu với ID ${materialId}`);
      }

      if (!material.is_active) {
        throw new ApiError(400, `Nguyên liệu ${material.name} đã ngừng hoạt động, không thể kiểm kê.`);
      }

      // Variance: actual - system
      const variance = actualQuantity - systemQuantity;
      const detailId = randomUUID();

      // 2. Insert detail row
      await connection.execute(
        `
        INSERT INTO inventory_audit_details (id, audit_id, material_id, system_quantity, actual_quantity, variance, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [detailId, auditId, materialId, systemQuantity, actualQuantity, variance, itemNote]
      );

      detailsList.push({
        id: detailId,
        auditId,
        materialId,
        materialName: material.name,
        systemQuantity,
        actualQuantity,
        variance,
        note: itemNote,
      });

      if (status === "completed") {
        // Adjust quantity
        await connection.execute(
          "UPDATE raw_materials SET stock_quantity = ? WHERE id = ?",
          [actualQuantity, materialId]
        );
        updatedMaterialsLog.push({
          name: material.name,
          oldQty: Number(material.stock_quantity),
          newQty: actualQuantity,
        });
      }
    }

    await connection.commit();

    // Create Audit Log (SUA_KHO) if completed
    if (status === "completed") {
      try {
        const [userRows] = await connection.execute<RowDataPacket[]>(
          `SELECT u.full_name, r.name AS role_name 
           FROM users u 
           JOIN roles r ON u.role_id = r.id 
           WHERE u.id = ? 
           LIMIT 1`,
          [createdBy]
        );

        const userFullName = userRows[0]?.full_name || "Nhân viên";
        const rawRole = userRows[0]?.role_name || "staff";
        const userRole = rawRole.trim().toLowerCase() === "admin" || rawRole.trim().toLowerCase() === "manager" ? "QL" : "TN";

        let descriptionText = `Cân bằng kho từ kiểm kê. Chi tiết chênh lệch: `;
        const logDetails = updatedMaterialsLog.map(m => `${m.name} (${m.oldQty} -> ${m.newQty})`);
        descriptionText += logDetails.join(", ");

        await connection.execute(
          `
          INSERT INTO audit_logs (id, user_id, user_name, role, action_type, target_object, description)
          VALUES (?, ?, ?, ?, 'SUA_KHO', ?, ?)
          `,
          [
            randomUUID(),
            createdBy,
            userFullName,
            userRole,
            "Kiểm kê kho hàng",
            descriptionText
          ]
        );
      } catch (logErr) {
        console.error("Error creating audit log for inventory audit completion:", logErr);
      }
    }

    return {
      id: auditId,
      createdBy,
      status,
      note,
      createdAt: new Date(),
      updatedAt: new Date(),
      details: detailsList,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateInventoryAudit(
  id: string,
  data: UpdateInventoryAuditBody,
  userId: string
): Promise<InventoryAudit> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check current audit status
    const [audits] = await connection.execute<RowDataPacket[]>(
      "SELECT id, status FROM inventory_audits WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );

    const audit = audits[0];
    if (!audit) {
      throw new ApiError(404, "Không tìm thấy phiếu kiểm kê.");
    }

    if (audit.status === "completed") {
      throw new ApiError(400, "Không thể chỉnh sửa phiếu kiểm kê đã hoàn thành.");
    }

    const note = data.note?.trim() || null;
    const status = data.status || "draft";

    if (status !== "draft" && status !== "completed") {
      throw new ApiError(400, "Trạng thái phiếu kiểm kê không hợp lệ.");
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new ApiError(400, "Vui lòng chọn ít nhất một nguyên liệu để kiểm kê.");
    }

    // 1. Update header
    await connection.execute(
      `
      UPDATE inventory_audits
      SET status = ?, note = ?
      WHERE id = ?
      `,
      [status, note, id]
    );

    // 2. Delete old details
    await connection.execute(
      "DELETE FROM inventory_audit_details WHERE audit_id = ?",
      [id]
    );

    const detailsList: InventoryAuditDetail[] = [];
    const updatedMaterialsLog: { name: string; oldQty: number; newQty: number }[] = [];

    // 3. Insert new details
    for (const item of data.items) {
      const materialId = item.materialId.trim();
      const systemQuantity = Number(item.systemQuantity);
      const actualQuantity = Number(item.actualQuantity);
      const itemNote = item.note?.trim() || null;

      if (!materialId || isNaN(systemQuantity) || isNaN(actualQuantity)) {
        throw new ApiError(400, "Thông tin chi tiết kiểm kê không hợp lệ.");
      }

      // Lock material row if we're completing, and get its current database values
      let mRows: RowDataPacket[];
      if (status === "completed") {
        [mRows] = await connection.execute<RowDataPacket[]>(
          "SELECT id, name, stock_quantity, is_active FROM raw_materials WHERE id = ? LIMIT 1 FOR UPDATE",
          [materialId]
        );
      } else {
        [mRows] = await connection.execute<RowDataPacket[]>(
          "SELECT id, name, stock_quantity, is_active FROM raw_materials WHERE id = ? LIMIT 1",
          [materialId]
        );
      }

      const material = mRows[0];
      if (!material) {
        throw new ApiError(404, `Không tìm thấy nguyên liệu với ID ${materialId}`);
      }

      if (!material.is_active) {
        throw new ApiError(400, `Nguyên liệu ${material.name} đã ngừng hoạt động, không thể kiểm kê.`);
      }

      const variance = actualQuantity - systemQuantity;
      const detailId = randomUUID();

      await connection.execute(
        `
        INSERT INTO inventory_audit_details (id, audit_id, material_id, system_quantity, actual_quantity, variance, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [detailId, id, materialId, systemQuantity, actualQuantity, variance, itemNote]
      );

      detailsList.push({
        id: detailId,
        auditId: id,
        materialId,
        materialName: material.name,
        systemQuantity,
        actualQuantity,
        variance,
        note: itemNote,
      });

      if (status === "completed") {
        // Adjust quantity
        await connection.execute(
          "UPDATE raw_materials SET stock_quantity = ? WHERE id = ?",
          [actualQuantity, materialId]
        );
        updatedMaterialsLog.push({
          name: material.name,
          oldQty: Number(material.stock_quantity),
          newQty: actualQuantity,
        });
      }
    }

    await connection.commit();

    // Create Audit Log (SUA_KHO) if completed
    if (status === "completed") {
      try {
        const [userRows] = await connection.execute<RowDataPacket[]>(
          `SELECT u.full_name, r.name AS role_name 
           FROM users u 
           JOIN roles r ON u.role_id = r.id 
           WHERE u.id = ? 
           LIMIT 1`,
          [userId]
        );

        const userFullName = userRows[0]?.full_name || "Nhân viên";
        const rawRole = userRows[0]?.role_name || "staff";
        const userRole = rawRole.trim().toLowerCase() === "admin" || rawRole.trim().toLowerCase() === "manager" ? "QL" : "TN";

        let descriptionText = `Cân bằng kho từ kiểm kê. Chi tiết chênh lệch: `;
        const logDetails = updatedMaterialsLog.map(m => `${m.name} (${m.oldQty} -> ${m.newQty})`);
        descriptionText += logDetails.join(", ");

        await connection.execute(
          `
          INSERT INTO audit_logs (id, user_id, user_name, role, action_type, target_object, description)
          VALUES (?, ?, ?, ?, 'SUA_KHO', ?, ?)
          `,
          [
            randomUUID(),
            userId,
            userFullName,
            userRole,
            "Kiểm kê kho hàng",
            descriptionText
          ]
        );
      } catch (logErr) {
        console.error("Error creating audit log for inventory audit completion:", logErr);
      }
    }

    return {
      id,
      createdBy: userId,
      status,
      note,
      createdAt: new Date(),
      updatedAt: new Date(),
      details: detailsList,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteInventoryAudit(id: string): Promise<void> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [audits] = await connection.execute<RowDataPacket[]>(
      "SELECT id, status FROM inventory_audits WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );

    const audit = audits[0];
    if (!audit) {
      throw new ApiError(404, "Không tìm thấy phiếu kiểm kê.");
    }

    if (audit.status === "completed") {
      throw new ApiError(400, "Không thể xóa phiếu kiểm kê đã hoàn thành.");
    }

    await connection.execute(
      "DELETE FROM inventory_audits WHERE id = ?",
      [id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function payGoodsReceiptDebt(id: string, amount: number): Promise<void> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT note, total_amount FROM goods_receipts WHERE id = ? LIMIT 1 FOR UPDATE",
      [id]
    );
    const receipt = rows[0];
    if (!receipt) {
      throw new ApiError(404, "Không tìm thấy phiếu nhập kho");
    }

    const totalAmount = Number(receipt.total_amount);
    const note = receipt.note || "";
    const match = note.match(/\[paid_amount:(\d+)\]/);
    const currentPaid = match ? Number(match[1]) : totalAmount;
    const remainingDebt = totalAmount - currentPaid;

    if (remainingDebt <= 0) {
      throw new ApiError(400, "Phiếu nhập kho này đã được thanh toán đầy đủ, không có công nợ.");
    }

    if (amount > remainingDebt) {
      throw new ApiError(400, `Số tiền thanh toán vượt quá khoản nợ còn lại (${remainingDebt} VND).`);
    }

    const newPaid = currentPaid + amount;
    let newNote = note;
    if (match) {
      newNote = note.replace(/\[paid_amount:\d+\]/, `[paid_amount:${newPaid}]`);
    } else {
      newNote = note ? `${note}\n[paid_amount:${newPaid}]` : `[paid_amount:${newPaid}]`;
    }

    await connection.execute(
      "UPDATE goods_receipts SET note = ? WHERE id = ?",
      [newNote, id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


