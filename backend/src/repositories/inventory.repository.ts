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

export async function findAllSuppliers(): Promise<Supplier[]> {
  const [rows] = await db.execute<SupplierRow[]>(
    "SELECT * FROM suppliers ORDER BY name ASC"
  );
  return rows.map((row) => mapSupplier(row));
}

export async function createSupplier(
  data: CreateSupplierBody
): Promise<Supplier> {
  const id = randomUUID();
  await db.execute(
    `
    INSERT INTO suppliers (id, name, contact_name, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.name.trim(),
      data.contactName?.trim() || null,
      data.phone.trim(),
      data.email?.trim() || null,
      data.address?.trim() || null,
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
  const [result] = await db.execute<ResultSetHeader>(
    `
    UPDATE suppliers
    SET name = ?, contact_name = ?, phone = ?, email = ?, address = ?
    WHERE id = ?
    `,
    [
      data.name.trim(),
      data.contactName?.trim() || null,
      data.phone.trim(),
      data.email?.trim() || null,
      data.address?.trim() || null,
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
      data.supplierId || null,
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
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    throw new ApiError(500, "Khong tao duoc nguyen lieu");
  }

  return mapMaterial(rows[0]);
}

export async function updateMaterial(
  id: string,
  data: UpdateMaterialBody
): Promise<Material> {
  const [result] = await db.execute<ResultSetHeader>(
    `
    UPDATE raw_materials
    SET name = ?, sku = ?, category = ?, unit = ?, supplier_id = ?, import_price = ?, is_active = ?
    WHERE id = ?
    `,
    [
      data.name.trim(),
      data.sku?.trim() || null,
      data.category?.trim() || "Khac",
      data.unit.trim(),
      data.supplierId || null,
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
  await db.execute("DELETE FROM raw_materials WHERE id = ?", [id]);

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

    const receiptId = randomUUID();
    let totalAmount = 0;
    const materialDetailsList: GoodsReceiptMaterialDetail[] = [];

    if (!Array.isArray(data.materialItems) || data.materialItems.length === 0) {
      throw new ApiError(400, "Vui long chon it nhat mot nguyen lieu nhap kho");
    }

    for (const item of data.materialItems) {
      const materialId = item.materialId.trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      if (!materialId || quantity <= 0 || unitPrice < 0) {
        throw new ApiError(400, "Thong tin nguyen lieu nhap kho khong hop le");
      }

      const [materials] = await connection.execute<RowDataPacket[]>(
        "SELECT id, name, unit FROM raw_materials WHERE id = ? AND is_active = TRUE LIMIT 1",
        [materialId]
      );

      const material = materials[0];
      if (!material) {
        throw new ApiError(404, `Khong tim thay nguyen lieu voi ID ${materialId}`);
      }

      const lineTotal = quantity * unitPrice;
      totalAmount += lineTotal;
      const detailId = randomUUID();

      await connection.execute(
        `
        INSERT INTO goods_receipt_material_details (id, receipt_id, material_id, quantity, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [detailId, receiptId, materialId, quantity, unitPrice, lineTotal]
      );

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
        createdBy,
        data.note?.trim() || null,
        totalAmount,
        receiptDate,
      ]
    );

    await connection.commit();

    // Get created user name
    const [users] = await connection.execute<RowDataPacket[]>(
      "SELECT full_name FROM users WHERE id = ? LIMIT 1",
      [createdBy]
    );
    const createdByName = users[0]?.full_name || null;

    // Get supplier name
    let supplierName = null;
    if (data.supplierId) {
      const [sups] = await connection.execute<RowDataPacket[]>(
        "SELECT name FROM suppliers WHERE id = ? LIMIT 1",
        [data.supplierId]
      );
      supplierName = sups[0]?.name || null;
    }

    return {
      id: receiptId,
      supplierId: data.supplierId || null,
      supplierName,
      createdBy,
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
      "SELECT id, name, stock_quantity, status FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [productId]
    );

    const product = products[0];
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
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
