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

export interface GoodsReceiptItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateGoodsReceiptBody {
  supplierId: string | null;
  note?: string;
  items?: GoodsReceiptItem[];
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
}
