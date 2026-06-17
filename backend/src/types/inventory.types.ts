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
  unit: string;
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
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface GoodsReceipt {
  id: string;
  supplierId: string | null;
  supplierName?: string | null;
  createdBy: string;
  createdByName?: string | null;
  note: string | null;
  totalAmount: number;
  createdAt: Date;
  details?: GoodsReceiptDetail[];
  materialDetails?: GoodsReceiptMaterialDetail[];
}
