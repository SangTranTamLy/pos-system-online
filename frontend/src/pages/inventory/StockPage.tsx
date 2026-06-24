import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createGoodsReceipt,
  createMaterial,
  createSupplier,
  deleteMaterial,
  deleteSupplier,
  fetchGoodsReceipts,
  fetchMaterials,
  fetchSuppliers,
  updateMaterial,
  updateSupplier,
  fetchInventoryAudits,
  fetchInventoryAuditById,
  createInventoryAudit,
  updateInventoryAudit,
  deleteInventoryAudit,
  type GoodsReceipt,
  type Material,
  type Supplier,
  type InventoryAudit,
} from "../../api/inventory.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";

type MaterialStatusFilter = "all" | "active" | "inactive" | "low_stock" | "out";
type ReceiptItemDraft = {
  material: Material;
  quantity: number;
  unitPrice: number;
};
type NoticeState = {
  type: "success" | "error";
  message: string;
};

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0b1c30] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";
const labelClass =
  "mb-2 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
}

function getReceiptCode(receipt: GoodsReceipt) {
  return `PN-${receipt.id.slice(0, 8).toUpperCase()}`;
}

function getDisplayNote(note: string | null) {
  return (note || "")
    .replace(/\[paid_amount:\d+\]/g, "")
    .replace(/\[invoice:[^\]]*\]/g, "")
    .trim();
}

function getReceiptDetails(receipt: GoodsReceipt) {
  if (Array.isArray(receipt.materialDetails) && receipt.materialDetails.length > 0) {
    return receipt.materialDetails
      .map((detail) => `${detail.materialName} x${detail.quantity} ${detail.unit}`)
      .join(", ");
  }
  return getDisplayNote(receipt.note) || "Chưa có chi tiết";
}

function StatusBadge({ material }: { material: Material }) {
  if (!material.isActive) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-500">
        Ngừng bán
      </span>
    );
  }
  if (material.stockQuantity <= 0) {
    return (
      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-600">
        Hết hàng
      </span>
    );
  }
  if (material.stockQuantity <= 5) {
    return (
      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-extrabold text-[#f97316]">
        Sắp hết
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-600">
      Còn hàng
    </span>
  );
}

function BackToStockButton({
  onClick,
  accentClassName = "hover:border-[#f97316] hover:text-[#f97316]",
}: {
  onClick: () => void;
  accentClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50",
        accentClassName,
      ].join(" ")}
    >
      <Icon name="arrow_back" className="text-[18px]" />
      Quay lại
    </button>
  );
}

function StockActionHeader({
  eyebrow,
  title,
  onBack,
  accentClassName,
}: {
  eyebrow?: string;
  title: string;
  onBack: () => void;
  accentClassName?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow ? (
          <p className={["text-xs font-extrabold uppercase tracking-wide", accentClassName || "text-[#f97316]"].join(" ")}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-extrabold text-[#0b1c30]">{title}</h1>
      </div>
      <BackToStockButton
        onClick={onBack}
        accentClassName={
          accentClassName === "text-purple-600"
            ? "hover:border-purple-500 hover:text-purple-600"
            : undefined
        }
      />
    </div>
  );
}

export function StockPage() {
  const { confirm: confirmAction } = useAppNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.split("/")[2] || "overview";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [audits, setAudits] = useState<InventoryAudit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<MaterialStatusFilter>("all");
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<InventoryAudit | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItemDraft[]>([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState<"receipts" | "suppliers">("receipts");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [receiptSearchQuery, setReceiptSearchQuery] = useState<string>("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formNote, setFormNote] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");

  // Audits state
  const [auditItems, setAuditItems] = useState<Array<{
    material: Material;
    systemQuantity: number;
    actualQuantity: number;
    note: string;
  }>>([]);
  const [auditNote, setAuditNote] = useState("");
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      setNotice(null);
      const [materialResponse, supplierResponse, receiptResponse, auditsResponse] = await Promise.all([
        fetchMaterials(),
        fetchSuppliers(),
        fetchGoodsReceipts(),
        fetchInventoryAudits(),
      ]);
      setMaterials(materialResponse.data);
      setSuppliers(supplierResponse.data);
      setReceipts(receiptResponse.data);
      setAudits(auditsResponse.data || []);
      setFormSupplierId((current) => current || supplierResponse.data[0]?.id || "");
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu kho hàng.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAllData);
  }, [loadAllData]);

  const categories = useMemo(
    () => [...new Set(materials.map((material) => material.category || "Khác"))],
    [materials]
  );

  const lowStockMaterials = useMemo(
    () =>
      materials
        .filter((material) => material.isActive && material.stockQuantity <= 5)
        .sort((left, right) => left.stockQuantity - right.stockQuantity)
        .slice(0, 5),
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    const query = normalizeText(searchQuery);
    return materials.filter((material) => {
      const text = normalizeText(
        `${material.sku} ${material.name} ${material.category || ""} ${material.supplierName || ""}`
      );
      const matchesSearch = !query || text.includes(query);
      const matchesCategory =
        categoryFilter === "all" || (material.category || "Khác") === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && material.isActive && material.stockQuantity > 5) ||
        (statusFilter === "low_stock" && material.isActive && material.stockQuantity <= 5) ||
        (statusFilter === "out" && material.isActive && material.stockQuantity <= 0) ||
        (statusFilter === "inactive" && !material.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, materials, searchQuery, statusFilter]);

  const materialResults = useMemo(() => {
    const query = normalizeText(materialSearch);
    const activeMaterials = materials.filter((material) => material.isActive);
    if (!query) return activeMaterials.slice(0, 8);
    return activeMaterials
      .filter((material) =>
        normalizeText(
          `${material.name} ${material.sku} ${material.category} ${material.supplierName || ""}`
        ).includes(query)
      )
      .slice(0, 8);
  }, [materialSearch, materials]);

  const supplierDebts = useMemo(() => {
    return suppliers.map((s) => ({
      supplierId: s.id,
      supplierName: s.name,
      phone: s.phone,
      address: s.address || "---",
    }));
  }, [suppliers]);

  const filteredReceipts = useMemo(() => {
    const search = normalizeText(receiptSearchQuery);
    return receipts.filter((r) => {
      const code = getReceiptCode(r).toLowerCase();
      const supplierName = normalizeText(r.supplierName || "");
      const note = normalizeText(r.note || "");
      const details = normalizeText(getReceiptDetails(r));
      
      const matchesSearch =
        !search ||
        code.includes(search) ||
        supplierName.includes(search) ||
        note.includes(search) ||
        details.includes(search);

      const matchesSupplier =
        supplierFilter === "all" || r.supplierId === supplierFilter;

      return matchesSearch && matchesSupplier;
    });
  }, [receipts, receiptSearchQuery, supplierFilter]);

  function showNotice(message: string, type: NoticeState["type"] = "error") {
    setNotice({ type, message });
  }

  function addMaterialToReceipt(material: Material) {
    setReceiptItems((current) => {
      const existed = current.find((item) => item.material.id === material.id);
      if (existed) {
        return current.map((item) =>
          item.material.id === material.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...current,
        {
          material,
          quantity: 1,
          unitPrice: Number(material.importPrice || 0),
        },
      ];
    });
    setMaterialSearch("");
  }

  function updateReceiptItem(materialId: string, field: "quantity" | "unitPrice", value: number) {
    setReceiptItems((current) =>
      current.map((item) =>
        item.material.id === materialId ? { ...item, [field]: Math.max(value, 0) } : item
      )
    );
  }

  function resetReceiptForm() {
    setFormNote("");
    setReceiptItems([]);
    setMaterialSearch("");
  }

  async function handleCreateReceiptSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formSupplierId) {
      showNotice("Vui lòng chọn nhà cung cấp trước khi lập phiếu.");
      return;
    }
    if (receiptItems.length === 0) {
      showNotice("Vui lòng chọn ít nhất một hàng hóa nhập kho.");
      return;
    }
    const invalidItem = receiptItems.find(
      (item) => item.quantity <= 0 || item.unitPrice < 0
    );
    if (invalidItem) {
      showNotice("Số lượng và giá nhập phải hợp lệ.");
      return;
    }

    try {
      setIsSubmitting(true);
      await createGoodsReceipt({
        supplierId: formSupplierId,
        note: formNote.trim(),
        materialItems: receiptItems.map((item) => ({
          materialId: item.material.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      resetReceiptForm();
      await loadAllData();
      showNotice("Đã tạo phiếu nhập kho.", "success");
      navigate("/stock");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa tạo được phiếu nhập.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function addMaterialToAudit(material: Material) {
    setAuditItems((current) => {
      const existed = current.find((item) => item.material.id === material.id);
      if (existed) return current;
      return [
        ...current,
        {
          material,
          systemQuantity: Number(material.stockQuantity || 0),
          actualQuantity: Number(material.stockQuantity || 0),
          note: "",
        },
      ];
    });
    setMaterialSearch("");
  }

  function updateAuditItem(
    materialId: string,
    field: "actualQuantity" | "note",
    value: number | string
  ) {
    setAuditItems((current) =>
      current.map((item) => {
        if (item.material.id !== materialId) return item;

        if (field === "actualQuantity") {
          return {
            ...item,
            actualQuantity: Math.max(Number(value || 0), 0),
          };
        }

        return {
          ...item,
          note: String(value),
        };
      })
    );
  }

  async function handleAuditSubmit(status: "draft" | "completed") {
    if (auditItems.length === 0) {
      showNotice("Vui lòng chọn ít nhất một nguyên liệu để kiểm kê.");
      return;
    }

    try {
      setIsSubmitting(true);
      setNotice(null);

      const payload = {
        status,
        note: auditNote.trim() || null,
        items: auditItems.map((item) => ({
          materialId: item.material.id,
          systemQuantity: item.systemQuantity,
          actualQuantity: item.actualQuantity,
          note: item.note ? item.note.trim() : null,
        })),
      };

      if (editingAuditId) {
        await updateInventoryAudit(editingAuditId, payload);
      } else {
        await createInventoryAudit(payload);
      }

      setNotice({
        type: "success",
        message: status === "completed" ? "Đã hoàn thành và cân bằng kho." : "Đã lưu phiếu kiểm kê nháp.",
      });

      // Reset
      setAuditItems([]);
      setAuditNote("");
      setEditingAuditId(null);
      setMaterialSearch("");

      await loadAllData();
      navigate("/stock/audit");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Có lỗi xảy ra khi lưu phiếu kiểm kê.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteAudit(id: string) {
    const confirmed = await confirmAction({
      title: "Xóa bản nháp kiểm kê",
      message: "Bạn có chắc chắn muốn xóa bản nháp kiểm kê này?",
      confirmText: "Xóa",
      type: "warning",
    });
    if (!confirmed) return;
    try {
      setNotice(null);
      await deleteInventoryAudit(id);
      setNotice({
        type: "success",
        message: "Đã xóa bản nháp kiểm kê thành công.",
      });
      await loadAllData();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Không xóa được phiếu kiểm kê.");
    }
  }

  async function handleViewAuditDetails(auditId: string) {
    try {
      setIsLoading(true);
      setNotice(null);
      const response = await fetchInventoryAuditById(auditId);
      if (response.success && response.data) {
        setSelectedAudit(response.data);
      } else {
        showNotice("Không tìm thấy thông tin chi tiết phiếu kiểm kê.");
      }
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Có lỗi xảy ra khi tải chi tiết phiếu kiểm kê."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function startEditingAudit(auditId: string) {
    try {
      setIsLoading(true);
      setNotice(null);
      const response = await fetchInventoryAuditById(auditId);
      if (!response.success || !response.data) {
        showNotice("Không tìm thấy thông tin chi tiết phiếu kiểm kê.");
        return;
      }
      const fullAudit = response.data;
      if (fullAudit.status === "completed") {
        showNotice("Không thể chỉnh sửa phiếu kiểm kê đã hoàn thành.");
        return;
      }
      setEditingAuditId(fullAudit.id);
      setAuditNote(fullAudit.note || "");

      const items = (fullAudit.details || []).map((d) => {
        const mat = materials.find((m) => m.id === d.materialId);
        return {
          material: mat || ({
            id: d.materialId,
            name: d.materialName || "Nguyên liệu đã bị xóa",
            sku: d.sku || "",
            category: d.category || "",
            unit: d.unit || "",
            stockQuantity: d.systemQuantity,
            importPrice: 0,
            isActive: false,
            createdAt: "",
            updatedAt: "",
          } as Material),
          systemQuantity: d.systemQuantity,
          actualQuantity: d.actualQuantity,
          note: d.note || "",
        };
      });

      setAuditItems(items);
      navigate("/stock/audit/create");
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Có lỗi xảy ra khi tải thông tin phiếu kiểm kê."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function cancelAuditEdit() {
    setAuditItems([]);
    setAuditNote("");
    setEditingAuditId(null);
    setMaterialSearch("");
    navigate("/stock/audit");
  }

  async function handleSaveMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      sku: String(formData.get("sku") || "").trim() || undefined,
      category: String(formData.get("category") || "Khác").trim(),
      unit: String(formData.get("unit") || "").trim(),
      importPrice: Number(formData.get("importPrice") || 0),
      supplierId: String(formData.get("supplierId") || "") || null,
      isActive: String(formData.get("status") || "active") === "active",
    };

    try {
      setIsSubmitting(true);
      if (editingMaterial) {
        await updateMaterial(editingMaterial.id, payload);
      } else {
        await createMaterial(payload);
      }
      setShowMaterialModal(false);
      setEditingMaterial(null);
      await loadAllData();
      showNotice(editingMaterial ? "Đã lưu thay đổi hàng hóa." : "Đã thêm hàng hóa mới.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa lưu được hàng hóa.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMaterial(material: Material) {
    const confirmed = await confirmAction({
      title: "Xóa hàng hóa",
      message: `Bạn có chắc chắn muốn xóa "${material.name}" không?`,
      confirmText: "Xóa",
      type: "warning",
    });
    if (!confirmed) return;
    try {
      await deleteMaterial(material.id);
      await loadAllData();
      showNotice("Đã xóa hàng hóa.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa xóa được hàng hóa.");
    }
  }

  async function handleSaveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      contactName: String(formData.get("contact") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      address: String(formData.get("address") || "").trim(),
    };

    if (!/^\d{10}$/.test(payload.phone)) {
      showNotice("Số điện thoại nhà cung cấp phải gồm đúng 10 chữ số.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload);
      } else {
        await createSupplier(payload);
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      await loadAllData();
      showNotice(editingSupplier ? "Đã lưu thay đổi nhà cung cấp." : "Đã thêm nhà cung cấp mới.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa lưu được nhà cung cấp.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    const confirmed = await confirmAction({
      title: "Xóa nhà cung cấp",
      message: `Bạn có chắc chắn muốn xóa nhà cung cấp "${supplier.name}" không?`,
      confirmText: "Xóa",
      type: "warning",
    });
    if (!confirmed) return;
    try {
      await deleteSupplier(supplier.id);
      await loadAllData();
      showNotice("Đã xóa nhà cung cấp.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa xóa được nhà cung cấp.");
    }
  }

  const isImportMode = currentPath === "import";
  const isAuditMode = currentPath === "audit";
  const isHistoryMode = currentPath === "history";
  const subPath = location.pathname.split("/")[3] || "";
  const isAuditCreateMode = isAuditMode && subPath === "create";

  return (
    <AdminLayout
      title="Quản lý kho hàng"
      subtitle="Theo dõi nhập xuất tồn, kiểm soát số lượng và cảnh báo tồn kho."
    >
      <div className="min-h-full w-full space-y-5 overflow-x-hidden bg-[#f8f9ff] font-['Inter',sans-serif]">
        {notice ? (
          <div
            className={[
              "rounded-lg border px-4 py-3 text-sm font-bold",
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            ].join(" ")}
          >
            {notice.message}
          </div>
        ) : null}

        {isImportMode ? (
          <form onSubmit={handleCreateReceiptSubmit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <StockActionHeader
                title="Lập phiếu nhập kho"
                onBack={() => navigate("/stock")}
              />

              <div className="relative">
                <Icon
                  name="search"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={materialSearch}
                  onChange={(event) => setMaterialSearch(event.target.value)}
                  placeholder="Tìm tên, mã hoặc danh mục hàng hóa..."
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm font-bold outline-none focus:border-[#f97316]"
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {materialResults.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => addMaterialToReceipt(material)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-[#f97316]"
                  >
                    <div>
                      <p className="font-extrabold text-[#0b1c30]">{material.name}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        SKU: {material.sku} - Tồn: {material.stockQuantity}
                      </p>
                    </div>
                    <Icon name="add" className="text-[#f97316]" />
                  </button>
                ))}
              </div>

              <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-180 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-extrabold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Hàng hóa</th>
                      <th className="px-4 py-3">Số lượng</th>
                        <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receiptItems.map((item) => (
                      <tr key={item.material.id}>
                        <td className="px-4 py-3 font-extrabold text-[#0b1c30]">
                          {item.material.name}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) =>
                              updateReceiptItem(item.material.id, "quantity", Number(event.target.value))
                            }
                            className={inputClass}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptItems((current) =>
                                current.filter((draft) => draft.material.id !== item.material.id)
                              )
                            }
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Icon name="delete" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {receiptItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                          Chưa chọn hàng hóa nhập kho.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-[#0b1c30]">
                  Thông tin phiếu
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Nhà cung cấp *</label>
                    <select
                      required
                      value={formSupplierId}
                      onChange={(event) => setFormSupplierId(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Chọn nhà cung cấp</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Ghi chú</label>
                    <textarea
                      rows={4}
                      value={formNote}
                      onChange={(event) => setFormNote(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-[#f97316]"
                    />
                  </div>
                </div>
              </section>
              <button
                type="submit"
                disabled={isSubmitting || receiptItems.length === 0}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#f97316] text-sm font-extrabold text-white hover:bg-[#ea580c] disabled:bg-slate-300"
              >
                <Icon name="check" />
                {isSubmitting ? "Đang xử lý..." : "Xác nhận nhập kho"}
              </button>
            </aside>
          </form>
        ) : isAuditMode && isAuditCreateMode ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <StockActionHeader
                title={editingAuditId ? "Sửa phiếu kiểm kê" : "Lập phiếu kiểm kê"}
                onBack={cancelAuditEdit}
              />

              <div className="relative">
                <Icon
                  name="search"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={materialSearch}
                  onChange={(event) => setMaterialSearch(event.target.value)}
                  placeholder="Tìm tên hoặc mã nguyên liệu để kiểm kê..."
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm font-bold outline-none focus:border-[#f97316]"
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {materialResults
                  .filter((m) => !auditItems.some((item) => item.material.id === m.id))
                  .map((material) => (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => addMaterialToAudit(material)}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-[#f97316] transition-all duration-200 shadow-sm"
                    >
                      <div>
                        <p className="font-extrabold text-[#0b1c30]">{material.name}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          SKU: {material.sku} - ĐVT: {material.unit} - Tồn hiện tại: {material.stockQuantity}
                        </p>
                      </div>
                      <Icon name="add" className="text-[#f97316]" />
                    </button>
                  ))}
                {materialSearch && materialResults.filter((m) => !auditItems.some((item) => item.material.id === m.id)).length === 0 ? (
                  <p className="col-span-2 text-center text-sm font-semibold text-slate-400 py-2">
                    Không tìm thấy nguyên liệu phù hợp hoặc đã có trong danh sách.
                  </p>
                ) : null}
              </div>

              <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-180 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-extrabold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Nguyên liệu</th>
                      <th className="px-4 py-3 text-right">Tồn hệ thống</th>
                      <th className="px-4 py-3 text-right">Tồn thực tế</th>
                      <th className="px-4 py-3 text-right">Chênh lệch</th>
                      <th className="px-4 py-3">Ghi chú dòng</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditItems.map((item) => {
                      const variance = item.actualQuantity - item.systemQuantity;
                      return (
                        <tr key={item.material.id}>
                          <td className="px-4 py-3 font-extrabold text-[#0b1c30]">
                            <div>
                              <p>{item.material.name}</p>
                              <p className="text-xs font-normal text-slate-400">{item.material.sku}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-500">
                            {item.systemQuantity} {item.material.unit}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={item.actualQuantity}
                                onChange={(event) =>
                                  updateAuditItem(item.material.id, "actualQuantity", event.target.value)
                                }
                                className="h-9 w-24 rounded border border-slate-200 px-2 text-right text-sm font-bold outline-none focus:border-[#f97316]"
                              />
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-right font-extrabold ${variance < 0 ? "text-rose-500" : variance > 0 ? "text-emerald-600" : "text-slate-600"}`}>
                            {variance > 0 ? `+${variance}` : variance} {item.material.unit}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.note}
                              onChange={(event) =>
                                updateAuditItem(item.material.id, "note", event.target.value)
                              }
                              placeholder="Lý do chênh lệch..."
                              className="h-9 w-full rounded border border-slate-200 px-3 text-xs outline-none focus:border-[#f97316]"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setAuditItems((current) =>
                                  current.filter((draft) => draft.material.id !== item.material.id)
                                )
                              }
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Icon name="delete" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {auditItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                          Chưa chọn nguyên liệu để kiểm kê. Chọn nguyên liệu ở ô tìm kiếm phía trên.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-[#0b1c30]">
                  Thông tin kiểm kê
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Ghi chú đợt kiểm</label>
                    <textarea
                      rows={4}
                      value={auditNote}
                      onChange={(event) => setAuditNote(event.target.value)}
                      placeholder="Mô tả lý do hoặc ghi chú tổng quát..."
                      className="w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-[#f97316]"
                    />
                  </div>
                </div>
              </section>

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={isSubmitting || auditItems.length === 0}
                  onClick={() => void handleAuditSubmit("completed")}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:bg-slate-300 shadow-sm"
                >
                  <Icon name="done_all" />
                  {isSubmitting ? "Đang lưu..." : "Xác nhận & Cân bằng kho"}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || auditItems.length === 0}
                  onClick={() => void handleAuditSubmit("draft")}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#f97316] text-sm font-extrabold text-white hover:bg-[#ea580c] disabled:bg-slate-300 shadow-sm"
                >
                  <Icon name="save" />
                  Lưu bản tạm tính
                </button>
                <button
                  type="button"
                  onClick={cancelAuditEdit}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
              </div>
            </aside>
          </div>
        ) : isAuditMode ? (
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0b1c30]">
                    Lịch sử kiểm kê kho hàng
                  </h1>
                  <p className="text-sm font-semibold text-slate-500">
                    Danh sách các đợt kiểm kê thực tế và điều chỉnh chênh lệch tồn kho nguyên vật liệu
                  </p>
                </div>
                <div className="flex gap-2">
                  <BackToStockButton
                    onClick={() => navigate("/stock")}
                  />
                  <button
                    type="button"
                    onClick={() => navigate("/stock/audit/create")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f97316] px-4 text-sm font-extrabold text-white shadow-sm hover:bg-[#ea580c] transition"
                  >
                    <Icon name="add" className="text-[18px]" />
                    Tạo phiếu kiểm mới
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-245 text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-4">Mã phiếu</th>
                      <th className="px-5 py-4">Ngày kiểm kê</th>
                      <th className="px-5 py-4">Nhân viên thực hiện</th>
                      <th className="px-5 py-4">Ghi chú</th>
                      <th className="px-5 py-4">Trạng thái</th>
                      <th className="px-5 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {audits.map((audit) => (
                      <tr key={audit.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-5 font-bold text-slate-700">
                          KK-{audit.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">
                          {formatDateTime(audit.createdAt)}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">
                          {audit.createdByName || "Nhân viên"}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-500 max-w-xs truncate">
                          {audit.note || "---"}
                        </td>
                        <td className="px-5 py-4">
                          {audit.status === "completed" ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-600">
                              Đã cân bằng kho
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-600">
                              Phiếu tạm
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleViewAuditDetails(audit.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                              title="Xem chi tiết"
                            >
                              <Icon name="visibility" className="text-[20px]" />
                            </button>
                            {audit.status === "draft" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void startEditingAudit(audit.id)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50"
                                  title="Kiểm tiếp"
                                >
                                  <Icon name="edit" className="text-[20px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAudit(audit.id)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:border-rose-500 hover:bg-rose-50"
                                  title="Xóa phiếu"
                                >
                                  <Icon name="delete" className="text-[20px]" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {audits.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm font-bold text-slate-400">
                          Không tìm thấy phiếu kiểm kê nào trong lịch sử.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : isHistoryMode ? (
          <div className="space-y-6">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0b1c30]">
                  Lịch sử nhập kho & Quản lý NCC
                </h1>
                <p className="text-sm font-semibold text-slate-500">
                  Quản lý danh sách phiếu nhập hàng và danh sách các nhà cung cấp
                </p>
              </div>
              <div className="flex gap-2">
                <BackToStockButton onClick={() => {
                  setSupplierFilter("all");
                  setReceiptSearchQuery("");
                  navigate("/stock");
                }} />
              </div>
            </div>

            {/* Tab buttons */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveHistoryTab("receipts")}
                className={`px-5 py-3 text-sm font-extrabold border-b-2 transition-all duration-200 ${
                  activeHistoryTab === "receipts"
                    ? "border-[#f97316] text-[#f97316]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Lịch sử phiếu nhập
              </button>
              <button
                type="button"
                onClick={() => setActiveHistoryTab("suppliers")}
                className={`px-5 py-3 text-sm font-extrabold border-b-2 transition-all duration-200 ${
                  activeHistoryTab === "suppliers"
                    ? "border-[#f97316] text-[#f97316]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Nhà cung cấp
              </button>
            </div>

            {activeHistoryTab === "receipts" ? (
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={receiptSearchQuery}
                      onChange={(e) => setReceiptSearchQuery(e.target.value)}
                      placeholder="Tìm theo mã phiếu, nhà cung cấp, ghi chú..."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-[#0b1c30] outline-none focus:border-[#f97316]"
                    />
                  </div>
                  <div className="w-full md:w-64">
                    <select
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0b1c30] outline-none focus:border-[#f97316]"
                    >
                      <option value="all">Tất cả nhà cung cấp</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {(receiptSearchQuery || supplierFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptSearchQuery("");
                        setSupplierFilter("all");
                      }}
                      className="h-10 px-4 text-xs font-bold text-rose-500 hover:underline"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
                  <table className="w-full min-w-190 text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Mã phiếu</th>
                        <th className="px-5 py-4">Ngày nhập</th>
                        <th className="px-5 py-4">Nhà cung cấp</th>
                        <th className="px-5 py-4">Nguyên liệu</th>
                        <th className="px-5 py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReceipts.map((r) => (
                          <tr key={r.id} className="transition hover:bg-slate-50">
                            <td className="px-5 py-4 font-bold text-slate-700">
                              {getReceiptCode(r)}
                            </td>
                            <td className="px-5 py-4 font-semibold text-slate-600">
                              {formatDateTime(r.createdAt)}
                            </td>
                            <td className="px-5 py-4 font-bold text-slate-700">
                              {r.supplierName || "---"}
                            </td>
                            <td className="px-5 py-4 font-semibold text-slate-500 max-w-xs truncate" title={getReceiptDetails(r)}>
                              {getReceiptDetails(r)}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedReceipt(r)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                                  title="Xem chi tiết"
                                >
                                  <Icon name="visibility" className="text-[18px]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                      ))}
                      {filteredReceipts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-sm font-bold text-slate-400">
                            Không tìm thấy phiếu nhập nào.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
                  <table className="w-full min-w-160 text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Tên nhà cung cấp</th>
                        <th className="px-5 py-4">Số điện thoại</th>
                        <th className="px-5 py-4">Địa chỉ</th>
                        <th className="px-5 py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplierDebts.map((s) => (
                        <tr key={s.supplierId} className="transition hover:bg-slate-50">
                          <td className="px-5 py-4 font-bold text-slate-700">
                            {s.supplierName}
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-600">
                            {s.phone}
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-500 max-w-xs truncate">
                            {s.address}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSupplierFilter(s.supplierId);
                                setActiveHistoryTab("receipts");
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                            >
                              <Icon name="list_alt" className="text-[16px]" />
                              Xem phiếu nhập
                            </button>
                          </td>
                        </tr>
                      ))}
                      {supplierDebts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-12 text-center text-sm font-bold text-slate-400">
                            Chưa có nhà cung cấp nào.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section>
                <div className="rounded-xl border border-slate-100 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                    Cảnh báo tồn thấp
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("low_stock")}
                    className="text-xs font-bold text-[#f97316] hover:text-[#ea580c]"
                  >
                    Xem tất cả
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-180 text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Tên hàng</th>
                        <th className="px-5 py-4">Nhóm hàng</th>
                        <th className="px-5 py-4">Đơn vị</th>
                        <th className="px-5 py-4 text-right">Tồn hiện tại</th>
                        <th className="px-5 py-4 text-right">Tồn tối thiểu</th>
                        <th className="px-5 py-4">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lowStockMaterials.map((material) => (
                        <tr key={material.id}>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-[#0b1c30]">{material.name}</span>
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-500">
                            {material.category || "Khác"}
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-500">{material.unit}</td>
                          <td className="px-5 py-4 text-right font-extrabold text-red-500">
                            {material.stockQuantity}
                          </td>
                          <td className="px-5 py-4 text-right font-medium text-slate-500">5</td>
                          <td className="px-5 py-4">
                            <StatusBadge material={material} />
                          </td>
                        </tr>
                      ))}
                      {lowStockMaterials.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-sm font-bold text-slate-400">
                            Không có mặt hàng tồn thấp.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                </div>
              </section>

              <aside>
                <section className="h-full rounded-xl border border-slate-100 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                  <h2 className="font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                    Thao tác kho
                  </h2>
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-2">
                    {[
                      ["Nhập kho", "cloud_download", "text-emerald-500", () => navigate("/stock/import")],
                      ["Kiểm kê", "assignment", "text-purple-500", () => navigate("/stock/audit")],
                      ["Lịch sử", "history", "text-amber-500", () => navigate("/stock/history")],
                      ["Nhà cung cấp", "storefront", "text-slate-500", () => setShowSupplierModal(true)],
                    ].map(([label, icon, tone, onClick]) => (
                      <button
                        key={label as string}
                        type="button"
                        onClick={onClick as () => void}
                        className="flex min-h-22 flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 text-center transition hover:bg-orange-50"
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ${tone as string}`}
                        >
                          <Icon name={icon as string} />
                        </span>
                        <span className="text-xs font-extrabold text-[#0b1c30]">{label as string}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </aside>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                      Danh mục hàng hóa
                    </h2>
                  </div>
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Tìm kiếm tên hàng, mã hàng, barcode..."
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-[#0b1c30] outline-none focus:border-[#f97316]"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-[#f97316]"
                    >
                      <option value="all">Nhóm hàng</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as MaterialStatusFilter)
                      }
                      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-[#f97316]"
                    >
                      <option value="all">Trạng thái</option>
                      <option value="active">Còn hàng</option>
                      <option value="low_stock">Sắp hết</option>
                      <option value="out">Hết hàng</option>
                      <option value="inactive">Ngừng bán</option>
                    </select>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-extrabold text-slate-700 hover:bg-orange-50 hover:text-[#f97316]"
                    >
                      <Icon name="download" className="text-[18px]" />
                      Xuất Excel
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMaterial(null);
                      setShowMaterialModal(true);
                    }}
                    className="mb-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f97316] px-4 text-sm font-extrabold text-white shadow-sm hover:bg-[#ea580c]"
                  >
                    <Icon name="add" className="text-[18px]" />
                    Thêm hàng
                  </button>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-245 text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-4">Mã hàng</th>
                        <th className="px-5 py-4">Tên hàng</th>
                        <th className="px-5 py-4">Nhóm hàng</th>
                        <th className="px-5 py-4">Đơn vị</th>
                        <th className="px-5 py-4 text-right">Tồn kho</th>
                        <th className="px-5 py-4 text-right">Tồn tối thiểu</th>
                        <th className="px-5 py-4">Nhà cung cấp</th>
                        <th className="px-5 py-4">Trạng thái</th>
                        <th className="px-5 py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMaterials.map((material) => (
                        <tr key={material.id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-5 font-semibold text-slate-600">{material.sku}</td>
                          <td className="px-5 py-4">
                            <p className="font-extrabold text-[#0b1c30]">{material.name}</p>
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-600">
                            {material.category || "Khác"}
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-600">{material.unit}</td>
                          <td className="px-5 py-4 text-right font-extrabold text-[#0b1c30]">
                            {material.stockQuantity}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-slate-500">5</td>
                          <td className="px-5 py-4 text-slate-500">
                            {material.supplierName || "Chưa liên kết"}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge material={material} />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMaterial(material);
                                  setShowMaterialModal(true);
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                              >
                                <Icon name="edit" className="text-[20px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteMaterial(material)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-rose-500 hover:text-rose-600"
                              >
                                <Icon name="delete" className="text-[20px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!isLoading && filteredMaterials.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-5 py-12 text-center text-sm font-bold text-slate-400">
                            Không có hàng hóa phù hợp với bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        </div>
        )}

        {showMaterialModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <form
              onSubmit={handleSaveMaterial}
              className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-extrabold text-[#0b1c30]">
                  {editingMaterial ? "Sửa hàng hóa" : "Thêm hàng hóa mới"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialModal(false);
                    setEditingMaterial(null);
                  }}
                  className="p-1 text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Tên hàng hóa *</label>
                  <input
                    required
                    name="name"
                    type="text"
                    placeholder="VD: Cà phê hạt"
                    defaultValue={editingMaterial?.name || ""}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Mã hàng / SKU</label>
                  <input
                    name="sku"
                    type="text"
                    placeholder="VD: NL-CAFE"
                    defaultValue={editingMaterial?.sku || ""}
                    disabled={!!editingMaterial}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Danh mục</label>
                    <input
                      name="category"
                      type="text"
                      placeholder="VD: Cà phê, Sữa"
                      defaultValue={editingMaterial?.category || ""}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Đơn vị tính *</label>
                    <input
                      required
                      name="unit"
                      type="text"
                      placeholder="VD: kg, lon"
                      defaultValue={editingMaterial?.unit || ""}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Trạng thái</label>
                    <select
                      name="status"
                      defaultValue={editingMaterial ? (editingMaterial.isActive ? "active" : "inactive") : "active"}
                      className={inputClass}
                    >
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Ngừng bán</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Nhà cung cấp</label>
                  <select
                    name="supplierId"
                    defaultValue={editingMaterial?.supplierId || ""}
                    className={inputClass}
                  >
                    <option value="">Chọn nhà cung cấp</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMaterialModal(false);
                      setEditingMaterial(null);
                    }}
                    className="h-10 flex-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 flex-1 rounded-lg bg-[#f97316] text-xs font-bold text-white hover:bg-[#ea580c] disabled:bg-slate-300"
                  >
                    {isSubmitting ? "Đang xử lý..." : editingMaterial ? "Lưu thay đổi" : "Thêm mới"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}

        {showSupplierModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <form
              onSubmit={handleSaveSupplier}
              className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-extrabold text-[#0b1c30]">
                  {editingSupplier ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierModal(false);
                    setEditingSupplier(null);
                  }}
                  className="p-1 text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Tên nhà cung cấp *</label>
                  <input
                    required
                    name="name"
                    type="text"
                    placeholder="Nhà cung cấp A"
                    defaultValue={editingSupplier?.name || ""}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Người liên hệ</label>
                  <input
                    name="contact"
                    type="text"
                    placeholder="Anh B"
                    defaultValue={editingSupplier?.contactName || ""}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Số điện thoại *</label>
                    <input
                      required
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      placeholder="090..."
                      defaultValue={editingSupplier?.phone || ""}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      name="email"
                      type="email"
                      placeholder="example@mail.com"
                      defaultValue={editingSupplier?.email || ""}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Địa chỉ</label>
                  <input
                    name="address"
                    type="text"
                    placeholder="TP. Hồ Chí Minh"
                    defaultValue={editingSupplier?.address || ""}
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-3 border-t border-slate-100 pt-3">
                  {editingSupplier ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteSupplier(editingSupplier)}
                      className="h-10 rounded-lg border border-rose-200 px-4 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Xóa
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSupplierModal(false);
                      setEditingSupplier(null);
                    }}
                    className="h-10 flex-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 flex-1 rounded-lg bg-[#f97316] text-xs font-bold text-white hover:bg-[#ea580c] disabled:bg-slate-300"
                  >
                    {isSubmitting ? "Đang xử lý..." : editingSupplier ? "Lưu thay đổi" : "Thêm mới"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}

        {selectedReceipt ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-extrabold text-[#0b1c30]">
                  Chi tiết phiếu nhập: {getReceiptCode(selectedReceipt)}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Nhà cung cấp</p>
                  <p className="mt-1 font-extrabold text-[#0b1c30]">
                    {selectedReceipt.supplierName || "Không có"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Ngày nhập</p>
                  <p className="mt-1 font-extrabold text-[#0b1c30]">
                    {formatDateTime(selectedReceipt.createdAt)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-600">
                {getReceiptDetails(selectedReceipt)}
              </p>
            </div>
          </div>
        ) : null}


        {selectedAudit ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-extrabold text-[#0b1c30]">
                  Chi tiết phiếu kiểm kê: KK-{selectedAudit.id.slice(0, 8).toUpperCase()}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedAudit(null)}
                  className="p-1 text-slate-400 hover:bg-slate-100"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs">
                <div>
                  <p className="font-bold text-slate-400 uppercase">Nhân viên lập</p>
                  <p className="mt-1 font-extrabold text-[#0b1c30]">{selectedAudit.createdByName || "Nhân viên"}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase">Ngày lập</p>
                  <p className="mt-1 font-extrabold text-[#0b1c30]">{formatDateTime(selectedAudit.createdAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase">Trạng thái</p>
                  <p className="mt-1 font-extrabold">
                    {selectedAudit.status === "completed" ? (
                      <span className="text-emerald-600">Đã cân bằng kho</span>
                    ) : (
                      <span className="text-amber-600">Phiếu tạm tính (Nháp)</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-bold text-slate-400 uppercase">Ghi chú phiếu kiểm</p>
                <p className="mt-1 text-sm font-semibold text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedAudit.note || "Không có ghi chú"}
                </p>
              </div>

              <h3 className="mt-6 mb-3 text-sm font-extrabold text-[#0b1c30] uppercase tracking-wide">
                Danh sách nguyên liệu kiểm kê
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-180 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-extrabold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Nguyên liệu</th>
                      <th className="px-4 py-3 text-right">Tồn hệ thống</th>
                      <th className="px-4 py-3 text-right">Tồn thực tế</th>
                      <th className="px-4 py-3 text-right">Chênh lệch</th>
                      <th className="px-4 py-3">Ghi chú dòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedAudit.details || []).map((detail) => (
                      <tr key={detail.id}>
                        <td className="px-4 py-3 font-extrabold text-[#0b1c30]">
                          <div>
                            <p>{detail.materialName || "Nguyên liệu đã xóa"}</p>
                            <p className="text-xs font-normal text-slate-400">{detail.sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-500">
                          {detail.systemQuantity} {detail.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-[#0b1c30]">
                          {detail.actualQuantity} {detail.unit}
                        </td>
                        <td className={`px-4 py-3 text-right font-extrabold ${detail.variance < 0 ? "text-rose-500" : detail.variance > 0 ? "text-emerald-600" : "text-slate-600"}`}>
                          {detail.variance > 0 ? `+${detail.variance}` : detail.variance} {detail.unit}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs italic">
                          {detail.note || "---"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}

export default StockPage;
