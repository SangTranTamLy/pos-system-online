export interface Supplier {
  id: string;
  name: string;
  contactName?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSupplierBody {
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
}

export type UpdateSupplierBody = CreateSupplierBody;

export interface Material {
  id: string;
  name: string;
  sku: string;
  category: string;
  /** Đơn vị tồn kho, kiểm kê và định mức công thức. */
  unit: string;
  /** Đơn vị mua từ nhà cung cấp. */
  purchaseUnit: string;
  /** 1 purchaseUnit bằng bao nhiêu unit. */
  purchaseToStockFactor: number;
  supplierId?: string | null;
  supplierName?: string | null;
  stockQuantity: number;
  importPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMaterialBody {
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  purchaseUnit?: string;
  purchaseToStockFactor?: number;
  supplierId?: string | null;
  stockQuantity?: number;
  importPrice?: number;
  isActive?: boolean;
}

export type UpdateMaterialBody = CreateMaterialBody;

export interface GoodsReceiptItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface GoodsReceiptMaterialItem {
  materialId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateGoodsReceiptBody {
  supplierId: string | null;
  note?: string;
  materialItems?: GoodsReceiptMaterialItem[];
  totalAmount?: number;
  createdAt?: string;
}

export interface GoodsReceiptDetail {
  id: string;
  receiptId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface GoodsReceiptMaterialDetail {
  id: string;
  receiptId: string;
  materialId: string;
  materialName: string;
  /** Đơn vị nhập tại thời điểm lập phiếu. */
  purchaseUnit: string;
  unit: string;
  /** Số đơn vị nhập. */
  quantity: number;
  /** Hệ số quy đổi được chụp tại thời điểm nhập. */
  conversionFactor: number;
  /** Số lượng đã cộng vào tồn kho theo đơn vị tồn. */
  stockQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface GoodsReceipt {
  id: string;
  supplierId: string | null;
  supplierName?: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  note: string | null;
  totalAmount: number;
  createdAt: Date;
  details?: GoodsReceiptDetail[];
  materialDetails?: GoodsReceiptMaterialDetail[];
}

export interface InventoryAudit {
  id: string;
  createdBy: string;
  createdByName?: string | null;
  status: "draft" | "completed";
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  details?: InventoryAuditDetail[];
}

export interface InventoryAuditDetail {
  id: string;
  auditId: string;
  materialId: string;
  materialName?: string;
  sku?: string;
  category?: string;
  unit?: string;
  systemQuantity: number;
  actualQuantity: number;
  variance: number;
  note: string | null;
}

export interface InventoryAuditDetailInput {
  materialId: string;
  systemQuantity: number;
  actualQuantity: number;
  note?: string | null;
}

export interface CreateInventoryAuditBody {
  status: "draft" | "completed";
  note?: string | null;
  items: InventoryAuditDetailInput[];
}

export interface UpdateInventoryAuditBody {
  status: "draft" | "completed";
  note?: string | null;
  items: InventoryAuditDetailInput[];
}
