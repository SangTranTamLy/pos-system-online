import { randomUUID } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { db } from "../config/database";
import type {
  Supplier,
  CreateSupplierBody,
  CreateGoodsReceiptBody,
  GoodsReceipt,
  GoodsReceiptDetail,
} from "../types/inventory.types";
import { ApiError } from "../utils/apiError";

type SupplierRow = RowDataPacket & Supplier;
type GoodsReceiptRow = RowDataPacket & GoodsReceipt;
type GoodsReceiptDetailRow = RowDataPacket & GoodsReceiptDetail;

export async function findAllSuppliers(): Promise<Supplier[]> {
  const [rows] = await db.execute<SupplierRow[]>(
    "SELECT * FROM suppliers ORDER BY name ASC"
  );
  return rows;
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

  return rows[0];
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
    let totalAmount = data.totalAmount || 0;
    const detailsList: any[] = [];

    // 2. Loop through products if items are provided (for backward compatibility / updates)
    if (Array.isArray(data.items) && data.items.length > 0) {
      totalAmount = 0;
      for (const item of data.items) {
        const productId = item.productId.trim();
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);

        if (!productId || quantity <= 0 || unitPrice < 0) {
          throw new ApiError(400, "Thông tin sản phẩm nhập kho không hợp lệ");
        }

        // Check product existence
        const [products] = await connection.execute<RowDataPacket[]>(
          "SELECT id, name, stock_quantity, status FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
          [productId]
        );

        const product = products[0];
        if (!product) {
          throw new ApiError(404, `Không tìm thấy sản phẩm với ID ${productId}`);
        }

        const lineTotal = quantity * unitPrice;
        totalAmount += lineTotal;

        const detailId = randomUUID();
        // Insert detail
        await connection.execute(
          `
          INSERT INTO goods_receipt_details (id, receipt_id, product_id, quantity, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [detailId, receiptId, productId, quantity, unitPrice, lineTotal]
        );

        // Update stock level on product
        await connection.execute(
          `
          UPDATE products
          SET
            stock_quantity = stock_quantity + ?,
            status = CASE
              WHEN status = 'out_of_stock' AND stock_quantity + ? > 0 THEN 'active'
              ELSE status
            END
          WHERE id = ?
          `,
          [quantity, quantity, productId]
        );

        // Log stock transaction
        await connection.execute(
          `
          INSERT INTO stock_transactions (id, product_id, created_by, transaction_type, quantity, note)
          VALUES (?, ?, ?, 'import', ?, ?)
          `,
          [
            randomUUID(),
            productId,
            createdBy,
            quantity,
            `Nhập kho - Phiếu nhập ${receiptId}`,
          ]
        );

        detailsList.push({
          id: detailId,
          receiptId,
          productId,
          productName: product.name,
          quantity,
          unitPrice,
          lineTotal,
        });
      }
    }

    const receiptDate = data.createdAt ? new Date(data.createdAt) : new Date();

    // 3. Create goods receipt header
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
      details: detailsList,
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
