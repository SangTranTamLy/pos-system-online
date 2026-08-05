import { apiRequest } from "./api-client";

export type Supplier = {
  id: string;
  name: string;
  contactName?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  debt?: number;
};

export type Material = {
  id: string;
  name: string;
  sku: string;
  category: string;
  /** Đơn vị tồn kho và định mức công thức. */
  unit: string;
  purchaseUnit: string;
  purchaseToStockFactor: number;
  supplierId?: string | null;
  supplierName?: string | null;
  stockQuantity: number;
  importPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoodsReceiptMaterialDetail = {
  id: string;
  receiptId: string;
  materialId: string;
  materialName: string;
  purchaseUnit: string;
  unit: string;
  quantity: number;
  conversionFactor: number;
  stockQuantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type GoodsReceiptDetail = {
  id: string;
  receiptId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type GoodsReceipt = {
  id: string;
  supplierId: string | null;
  supplierName?: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  note: string | null;
  totalAmount: number;
  createdAt: string;
  details: GoodsReceiptDetail[];
  materialDetails?: GoodsReceiptMaterialDetail[];
};

export type InventoryAuditDetail = {
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
};

export type InventoryAudit = {
  id: string;
  createdBy: string;
  createdByName?: string | null;
  status: "draft" | "completed";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  details?: InventoryAuditDetail[];
};

export type CreateInventoryAuditPayload = {
  status: "draft" | "completed";
  note?: string | null;
  items: Array<{
    materialId: string;
    systemQuantity: number;
    actualQuantity: number;
    note?: string | null;
  }>;
};

export type UpdateInventoryAuditPayload = CreateInventoryAuditPayload;

type SupplierPayload = {
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
};

type MaterialPayload = {
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  purchaseUnit?: string;
  purchaseToStockFactor?: number;
  supplierId?: string | null;
  importPrice?: number;
  isActive?: boolean;
};

export function fetchSuppliers() {
  return apiRequest<Supplier[]>({
    method: "GET",
    url: "/inventory/suppliers",
  });
}

export function createSupplier(payload: SupplierPayload) {
  return apiRequest<Supplier>({
    method: "POST",
    url: "/inventory/suppliers",
    data: payload,
  });
}

export function updateSupplier(id: string, payload: SupplierPayload) {
  return apiRequest<Supplier>({
    method: "PUT",
    url: `/inventory/suppliers/${id}`,
    data: payload,
  });
}

export function deleteSupplier(id: string) {
  return apiRequest<Supplier>({
    method: "DELETE",
    url: `/inventory/suppliers/${id}`,
  });
}

export function fetchMaterials() {
  return apiRequest<Material[]>({ method: "GET", url: "/inventory/materials" });
}

export function createMaterial(payload: MaterialPayload) {
  return apiRequest<Material>({
    method: "POST",
    url: "/inventory/materials",
    data: payload,
  });
}

export function fetchGoodsReceipts() {
  return apiRequest<GoodsReceipt[]>({
    method: "GET",
    url: "/inventory/receipts",
  });
}

export function createGoodsReceipt(payload: {
  supplierId: string | null;
  note?: string;
  materialItems?: Array<{
    materialId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount?: number;
  createdAt?: string;
}) {
  return apiRequest<GoodsReceipt>({
    method: "POST",
    url: "/inventory/receipts",
    data: payload,
  });
}

export function payGoodsReceiptDebt(id: string, amount: number) {
  return apiRequest<{ success: boolean; message?: string }>({
    method: "PUT",
    url: `/inventory/receipts/${id}/pay`,
    data: { amount },
  });
}

export function updateMaterial(id: string, payload: MaterialPayload) {
  return apiRequest<Material>({
    method: "PUT",
    url: `/inventory/materials/${id}`,
    data: payload,
  });
}

export function deleteMaterial(id: string) {
  return apiRequest<Material>({
    method: "DELETE",
    url: `/inventory/materials/${id}`,
  });
}

export function fetchInventoryAudits() {
  return apiRequest<InventoryAudit[]>({
    method: "GET",
    url: "/inventory/audits",
  });
}

export function fetchInventoryAuditById(id: string) {
  return apiRequest<InventoryAudit>({
    method: "GET",
    url: `/inventory/audits/${id}`,
  });
}

export function createInventoryAudit(payload: CreateInventoryAuditPayload) {
  return apiRequest<InventoryAudit>({
    method: "POST",
    url: "/inventory/audits",
    data: payload,
  });
}

export function updateInventoryAudit(
  id: string,
  payload: UpdateInventoryAuditPayload
) {
  return apiRequest<InventoryAudit>({
    method: "PUT",
    url: `/inventory/audits/${id}`,
    data: payload,
  });
}

export function deleteInventoryAudit(id: string) {
  return apiRequest<{ success: boolean; message?: string }>({
    method: "DELETE",
    url: `/inventory/audits/${id}`,
  });
}
