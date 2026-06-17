import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createGoodsReceipt,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchGoodsReceipts,
  fetchMaterials,
  fetchSuppliers,
  type GoodsReceipt,
  type Material,
  type Supplier,
} from "../../api/inventory.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type ReceiptItemDraft = {
  material: Material;
  quantity: number;
  unitPrice: number;
};

type PaymentFilter = "all" | "paid" | "partial" | "unpaid";
type NoticeState = {
  type: "success" | "error";
  message: string;
};

const inputClass =
  "h-10 w-full border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0b1c30] outline-none transition-colors focus:border-[#f97316]";
const labelClass =
  "mb-2 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getReceiptCode(receipt: GoodsReceipt) {
  return `PN-${receipt.id.slice(0, 8).toUpperCase()}`;
}

function getPaidAmount(receipt: GoodsReceipt) {
  const match = receipt.note?.match(/\[paid_amount:(\d+)\]/);

  if (!match) {
    return Number(receipt.totalAmount || 0);
  }

  return Number(match[1] || 0);
}

function getDisplayNote(note: string | null) {
  return (note || "")
    .replace(/\[paid_amount:\d+\]/g, "")
    .replace(/\[invoice:[^\]]*\]/g, "")
    .trim();
}

function getPaymentStatus(receipt: GoodsReceipt) {
  const total = Number(receipt.totalAmount || 0);
  const paid = getPaidAmount(receipt);

  if (total <= 0 || paid >= total) {
    return {
      key: "paid" as const,
      label: "Đã thanh toán",
      className: "bg-emerald-50 text-emerald-600",
    };
  }

  if (paid <= 0) {
    return {
      key: "unpaid" as const,
      label: "Chưa thanh toán",
      className: "bg-rose-50 text-rose-600",
    };
  }

  return {
    key: "partial" as const,
    label: "Nợ một phần",
    className: "bg-amber-50 text-amber-600",
  };
}

function getReceiptDetails(receipt: GoodsReceipt) {
  if (Array.isArray(receipt.materialDetails) && receipt.materialDetails.length > 0) {
    return receipt.materialDetails
      .map((detail) => `${detail.materialName} x${detail.quantity} ${detail.unit}`)
      .join(", ");
  }

  if (Array.isArray(receipt.details) && receipt.details.length > 0) {
    return receipt.details
      .map((detail) => `${detail.productName} x${detail.quantity}`)
      .join(", ");
  }

  return getDisplayNote(receipt.note) || "Chưa có chi tiết";
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className="flex min-h-[92px] items-center gap-4 border border-slate-200 bg-white p-5">
      <div className={`flex h-12 w-12 items-center justify-center ${tone}`}>
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-xl font-extrabold text-[#0b1c30]">{value}</p>
      </div>
    </article>
  );
}

export function StockPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = location.pathname.split("/")[2] || "history";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  const [showReceiptDetailsModal, setShowReceiptDetailsModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [materialSearch, setMaterialSearch] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formPaidAmount, setFormPaidAmount] = useState("0");
  const [receiptItems, setReceiptItems] = useState<ReceiptItemDraft[]>([]);

  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadErrorMessage("");
      const [materialResponse, supplierResponse, receiptResponse] = await Promise.all([
        fetchMaterials(),
        fetchSuppliers(),
        fetchGoodsReceipts(),
      ]);

      setMaterials(materialResponse.data);
      setSuppliers(supplierResponse.data);
      setReceipts(receiptResponse.data);

      if (supplierResponse.data[0]) {
        setFormSupplierId((currentSupplierId) =>
          currentSupplierId || supplierResponse.data[0].id
        );
      }
    } catch (error) {
      console.error("Không tải được dữ liệu nhập kho:", error);
      setLoadErrorMessage(
        error instanceof Error
          ? error.message
          : "Không tải được dữ liệu nguyên liệu, nhà cung cấp hoặc phiếu nhập."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadAllData();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadAllData]);

  function showNotice(message: string, type: NoticeState["type"] = "error") {
    setNotice({ type, message });
  }

  const totalAmount = receiptItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const paidAmount = Math.min(Number(formPaidAmount || 0), totalAmount);
  const debtAmount = Math.max(totalAmount - paidAmount, 0);

  const materialResults = useMemo(() => {
    const query = normalizeText(materialSearch);
    const activeMaterials = materials.filter((material) => material.isActive);
    if (!query) return activeMaterials.slice(0, 8);

    return activeMaterials
      .filter((material) => {
        const haystack = `${material.name} ${material.sku} ${material.category} ${material.unit} ${material.supplierName || ""}`;
        return normalizeText(haystack).includes(query);
      })
      .slice(0, 8);
  }, [materialSearch, materials]);

  const filteredReceipts = useMemo(() => {
    const query = normalizeText(searchQuery);
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return receipts.filter((receipt) => {
      const receiptTime = new Date(receipt.createdAt).getTime();
      const status = getPaymentStatus(receipt).key;
      const text = normalizeText(
        `${getReceiptCode(receipt)} ${receipt.supplierName || ""} ${receipt.note || ""}`
      );

      if (query && !text.includes(query)) return false;
      if (supplierFilter !== "all" && receipt.supplierId !== supplierFilter) return false;
      if (paymentFilter !== "all" && status !== paymentFilter) return false;
      if (fromTime && receiptTime < fromTime) return false;
      if (toTime && receiptTime > toTime) return false;

      return true;
    });
  }, [fromDate, paymentFilter, receipts, searchQuery, supplierFilter, toDate]);

  const receiptSummary = useMemo(() => {
    return receipts.reduce(
      (summary, receipt) => {
        const total = Number(receipt.totalAmount || 0);
        const paid = getPaidAmount(receipt);

        return {
          totalAmount: summary.totalAmount + total,
          paidAmount: summary.paidAmount + Math.min(paid, total),
          debtAmount: summary.debtAmount + Math.max(total - paid, 0),
        };
      },
      { totalAmount: 0, paidAmount: 0, debtAmount: 0 }
    );
  }, [receipts]);

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

  function removeReceiptItem(materialId: string) {
    setReceiptItems((current) =>
      current.filter((item) => item.material.id !== materialId)
    );
  }

  function resetReceiptForm() {
    setFormNote("");
    setFormPaidAmount("0");
    setReceiptItems([]);
    setMaterialSearch("");
  }

  async function handleCreateReceiptSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!formSupplierId) {
      showNotice("Vui lòng chọn nhà cung cấp trước khi lập phiếu.");
      return;
    }

    if (receiptItems.length === 0) {
      showNotice("Vui lòng chọn ít nhất một nguyên liệu nhập kho.");
      return;
    }

    const invalidItem = receiptItems.find(
      (item) => item.quantity <= 0 || item.unitPrice < 0
    );

    if (invalidItem) {
      showNotice("Số lượng và giá nhập phải hợp lệ.");
      return;
    }

    const noteParts = [
      `[paid_amount:${paidAmount}]`,
      formNote.trim(),
    ].filter(Boolean);

    try {
      setIsSubmitting(true);
      await createGoodsReceipt({
        supplierId: formSupplierId,
        note: noteParts.join("\n"),
        materialItems: receiptItems.map((item) => ({
          materialId: item.material.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      resetReceiptForm();
      await loadAllData();
      showNotice("Đã tạo phiếu nhập kho.", "success");
      navigate("/stock/history");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa tạo được phiếu nhập. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
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
      const response = editingSupplier
        ? await updateSupplier(editingSupplier.id, payload)
        : await createSupplier(payload);

      if (editingSupplier) {
        setSuppliers((current) =>
          current
            .map((supplier) =>
              supplier.id === response.data.id ? response.data : supplier
            )
            .sort((left, right) => left.name.localeCompare(right.name))
        );
      } else {
        setSuppliers((current) =>
          [...current, response.data].sort((left, right) =>
            left.name.localeCompare(right.name)
          )
        );
      }

      setShowSupplierModal(false);
      setEditingSupplier(null);
      showNotice(
        editingSupplier
          ? "Đã lưu thay đổi nhà cung cấp."
          : "Đã thêm nhà cung cấp mới.",
        "success"
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa lưu được nhà cung cấp. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp "${supplier.name}" không?`)) {
      return;
    }

    try {
      await deleteSupplier(supplier.id);
      await loadAllData();
      showNotice("Đã xóa nhà cung cấp.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa xóa được nhà cung cấp. Vui lòng thử lại.");
    }
  }

  async function handleAddMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      name: String(formData.get("name")),
      sku: String(formData.get("sku") || "") || undefined,
      category: String(formData.get("category") || "Khac"),
      unit: String(formData.get("unit")),
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
      showNotice(
        editingMaterial ? "Đã lưu thay đổi nguyên liệu." : "Đã thêm nguyên liệu mới.",
        "success"
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa lưu được nguyên liệu. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMaterial(material: Material) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nguyên liệu "${material.name}" không?`)) {
      return;
    }

    try {
      await deleteMaterial(material.id);
      await loadAllData();
      showNotice("Đã xóa nguyên liệu.", "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Chưa xóa được nguyên liệu. Vui lòng thử lại.");
    }
  }

  const paymentTabs: Array<{ key: PaymentFilter; label: string; count: number }> = [
    { key: "all", label: "Tất cả", count: receipts.length },
    {
      key: "paid",
      label: "Đã trả đủ",
      count: receipts.filter((receipt) => getPaymentStatus(receipt).key === "paid").length,
    },
    {
      key: "partial",
      label: "Nợ một phần",
      count: receipts.filter((receipt) => getPaymentStatus(receipt).key === "partial").length,
    },
    {
      key: "unpaid",
      label: "Nợ toàn bộ",
      count: receipts.filter((receipt) => getPaymentStatus(receipt).key === "unpaid").length,
    },
  ];

  return (
    <AdminLayout
      title="Kho hàng"
      subtitle="Quản lý lịch sử nhập hàng, nhà cung cấp và công nợ NCC."
    >
      {notice ? (
        <div
          className={`mb-4 flex items-start justify-between border p-4 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-4 text-lg leading-none opacity-70 hover:opacity-100"
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      ) : null}

      {currentTab === "import" ? (
        <div className="space-y-6">
          <section className="flex items-start gap-4 border-b border-slate-200 pb-6">
            <button
              type="button"
              onClick={() => navigate("/stock/history")}
              className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-white text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
              aria-label="Quay lai"
            >
              <Icon name="arrow_back" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-[#0b1c30]">
                Tạo Phiếu Nhập Kho
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Tạo đợt nhập hàng mới từ danh sách nguyên liệu.
              </p>
            </div>
          </section>

          {isLoading ? (
            <div className="border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
              Đang tải dữ liệu...
            </div>
          ) : loadErrorMessage ? (
            <div className="border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-600">
              Không tải được dữ liệu: {loadErrorMessage}. Hãy kiểm tra backend đang chạy và đăng nhập đúng tài khoản.
            </div>
          ) : (
            <form onSubmit={handleCreateReceiptSubmit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <section className="border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#0b1c30]">
                      Tìm nguyên liệu nhập kho
                    </h2>
                  </div>
                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={materialSearch}
                      onChange={(event) => setMaterialSearch(event.target.value)}
                      placeholder="Nhập tên, mã hoặc danh mục nguyên liệu..."
                      className="h-12 w-full border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold outline-none focus:border-[#f97316]"
                    />
                  </div>

                  <div className="mt-3">
                    <p className="mb-2 text-xs font-bold text-slate-400">
                      {materialSearch.trim()
                        ? "Kết quả tìm kiếm"
                        : "Nguyên liệu gần đây - bấm để thêm vào phiếu"}
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {materialResults.map((material) => (
                        <button
                          key={material.id}
                          type="button"
                          onClick={() => addMaterialToReceipt(material)}
                          className="flex items-center justify-between border border-slate-200 bg-white p-3 text-left hover:border-[#f97316]"
                        >
                          <div>
                            <p className="font-extrabold text-[#0b1c30]">{material.name}</p>
                            <p className="text-xs font-semibold text-slate-400">
                              SKU: {material.sku} - Ton hien tai: {material.stockQuantity} - Giá nhập:{" "}
                              {formatCurrency(material.importPrice)}
                            </p>
                          </div>
                          <Icon name="add" className="text-[#f97316]" />
                        </button>
                      ))}
                      {materialResults.length === 0 ? (
                        <p className="col-span-full border border-dashed border-slate-200 p-4 text-center text-sm font-bold text-slate-400">
                          Không tìm thấy nguyên liệu phù hợp. Hãy tạo nguyên liệu trong kho hàng trước.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white p-5">
                  <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-[#0b1c30]">
                    Nguyên liệu nhập kho
                  </h2>

                  {receiptItems.length === 0 ? (
                    <div className="flex min-h-[140px] items-center justify-center border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-extrabold text-slate-400">
                      Chưa có nguyên liệu nào được chọn. Hãy dùng ô tìm kiếm ở trên.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                          <tr>
                              <th className="py-3">Nguyên liệu</th>
                              <th className="w-28 py-3">Số lượng</th>
                              <th className="w-36 py-3">Giá nhập</th>
                              <th className="w-36 py-3 text-right">Thành tiền</th>
                              <th className="w-12 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {receiptItems.map((item) => (
                            <tr key={item.material.id}>
                              <td className="py-3">
                                <p className="font-extrabold text-[#0b1c30]">
                                  {item.material.name}
                                </p>
                                <p className="text-xs font-semibold text-slate-400">
                                  SKU: {item.material.sku} - Đơn vị: {item.material.unit}
                                </p>
                              </td>
                              <td className="py-3">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updateReceiptItem(
                                      item.material.id,
                                      "quantity",
                                      Number(event.target.value)
                                    )
                                  }
                                  className={inputClass}
                                />
                              </td>
                              <td className="py-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unitPrice}
                                  onChange={(event) =>
                                    updateReceiptItem(
                                      item.material.id,
                                      "unitPrice",
                                      Number(event.target.value)
                                    )
                                  }
                                  className={inputClass}
                                />
                              </td>
                              <td className="py-3 text-right font-extrabold text-[#0b1c30]">
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeReceiptItem(item.material.id)}
                                  className="text-slate-400 hover:text-rose-500"
                                  aria-label="Xóa nguyên liệu"
                                >
                                  <Icon name="delete" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-6">
                <section className="border border-slate-200 bg-white p-5">
                  <h2 className="mb-4 border-b border-slate-100 pb-4 text-sm font-extrabold uppercase tracking-wide text-[#0b1c30]">
                    Thông tin phiếu
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Nhà cung cấp *</label>
                      <div className="relative">
                        <Icon
                          name="person"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <select
                          value={formSupplierId}
                          onChange={(event) => setFormSupplierId(event.target.value)}
                          className="h-10 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-extrabold text-[#0b1c30] outline-none transition-colors focus:border-[#f97316]"
                          required
                        >
                          <option value="">Chọn nhà cung cấp</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Ghi chú phiếu</label>
                      <div className="relative">
                        <Icon name="description" className="absolute left-3 top-3 text-slate-400" />
                        <textarea
                          value={formNote}
                          onChange={(event) => setFormNote(event.target.value)}
                          placeholder="Lý do nhập hàng, đợt khuyến mãi..."
                          rows={4}
                          className="w-full border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#f97316]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Đã trả trước (VND)</label>
                      <div className="relative">
                        <Icon
                          name="attach_money"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="number"
                          min={0}
                          max={totalAmount}
                          value={formPaidAmount}
                          onChange={(event) => setFormPaidAmount(event.target.value)}
                          className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm font-extrabold text-[#0b1c30] outline-none transition-colors focus:border-[#f97316]"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormPaidAmount(String(totalAmount))}
                      className="h-10 w-full border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-600 hover:bg-white"
                    >
                      Trả dư toàn bộ
                    </button>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white p-5">
                  <div className="space-y-4 text-sm font-extrabold">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tổng tiền hàng:</span>
                      <span>{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Đã thanh toán:</span>
                      <span className="text-emerald-600">{formatCurrency(paidAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-4">
                      <span className="text-slate-500">Còn nợ nhà cung cấp:</span>
                      <span className={debtAmount > 0 ? "text-rose-600" : "text-emerald-600"}>
                        {formatCurrency(debtAmount)}
                      </span>
                    </div>
                  </div>
                  {debtAmount > 0 ? (
                    <div className="mt-5 flex gap-3 border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-6 text-rose-600">
                      <Icon name="info" className="mt-0.5 text-base" />
                      <span>
                        Chưa trả tiền. Hệ thống sẽ ghi nợ toàn bộ{" "}
                        {formatCurrency(debtAmount)} vào tài khoản nhà cung cấp.
                      </span>
                    </div>
                  ) : null}
                </section>

                <button
                  type="submit"
                  disabled={isSubmitting || receiptItems.length === 0}
                  className="flex h-12 w-full items-center justify-center gap-2 bg-[#f97316] text-sm font-extrabold text-white shadow-sm hover:bg-[#ea6c0a] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Icon name="check" />
                  {isSubmitting ? "Đang xử lý..." : "Xác nhận nhập kho."}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/stock/history")}
                  className="h-11 w-full border border-slate-200 bg-white text-sm font-extrabold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
              </aside>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-extrabold text-[#0b1c30]">
                <Icon name="local_shipping" className="text-[#f97316]" />
                Nhập kho và Công nợ
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Quản lý lịch sử nhập hàng từ nhà cung cấp, theo dõi chi tiết phiếu nhập và công nợ NCC.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/stock/import")}
                className="flex h-10 items-center gap-2 bg-[#f97316] px-5 text-sm font-extrabold text-white shadow-sm hover:bg-[#ea6c0a]"
              >
                <Icon name="add" />
                Lập phiếu nhập mới
              </button>
              <button
                type="button"
                onClick={() => void loadAllData()}
                className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-white text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                aria-label="Lam moi"
              >
                <Icon name="refresh" />
              </button>
            </div>
          </section>

          <nav className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/stock/history")}
              className={[
                "h-10 border px-4 text-sm font-extrabold transition-colors",
                (currentTab !== "suppliers" && currentTab !== "materials")
                  ? "border-[#f97316] bg-[#f97316] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#f97316] hover:text-[#f97316]",
              ].join(" ")}
            >
              Lịch sử nhập hàng
            </button>
            <button
              type="button"
              onClick={() => navigate("/stock/materials")}
              className={[
                "h-10 border px-4 text-sm font-extrabold transition-colors",
                currentTab === "materials"
                  ? "border-[#f97316] bg-[#f97316] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#f97316] hover:text-[#f97316]",
              ].join(" ")}
            >
              Nguyên liệu
            </button>
            <button
              type="button"
              onClick={() => navigate("/stock/suppliers")}
              className={[
                "h-10 border px-4 text-sm font-extrabold transition-colors",
                currentTab === "suppliers"
                  ? "border-[#f97316] bg-[#f97316] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#f97316] hover:text-[#f97316]",
              ].join(" ")}
            >
              Nhà cung cấp
            </button>
          </nav>

          {isLoading ? (
            <div className="border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
              Đang tải dữ liệu...
            </div>
          ) : loadErrorMessage ? (
            <div className="border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-600">
              Không tải được dữ liệu: {loadErrorMessage}. Hãy kiểm tra backend đang chạy và đăng nhập đúng tài khoản.
            </div>
          ) : currentTab === "materials" ? (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <StatCard
                  icon="inventory_2"
                  label="Tổng nguyên liệu"
                  value={String(materials.length)}
                  tone="bg-blue-50 text-blue-600"
                />
                <StatCard
                  icon="check_circle"
                  label="Đang hoạt động"
                  value={String(materials.filter((m) => m.isActive).length)}
                  tone="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  icon="warning"
                  label="Ngừng hoạt động"
                  value={String(materials.filter((m) => !m.isActive).length)}
                  tone="bg-amber-50 text-amber-600"
                />
              </section>

              <section className="border border-slate-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Tìm kiếm tên, SKU, danh mục nguyên liệu..."
                      className="h-10 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#f97316]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMaterial(null);
                      setShowMaterialModal(true);
                    }}
                    className="h-10 border border-slate-200 bg-white text-sm font-extrabold text-slate-600 hover:border-[#f97316] hover:text-[#f97316] flex items-center justify-center gap-1"
                  >
                    <Icon name="add" className="text-sm" />
                    Thêm nguyên liệu
                  </button>
                </div>
              </section>

              <section className="overflow-x-auto border border-slate-200 bg-white">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-4">Nguyên liệu</th>
                      <th className="px-5 py-4">Danh mục</th>
                      <th className="px-5 py-4">Đơn vị</th>
                      <th className="px-5 py-4 text-right">Giá nhập mặc định</th>
                      <th className="px-5 py-4">Nhà cung cấp mặc định</th>
                      <th className="px-5 py-4">Trạng thái</th>
                      <th className="px-5 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials
                      .filter((material) => {
                        const query = normalizeText(searchQuery);
                        const text = normalizeText(
                          `${material.name} ${material.sku} ${material.category || ""} ${material.unit} ${material.supplierName || ""}`
                        );

                        return !query || text.includes(query);
                      })
                      .map((material) => {
                        return (
                          <tr key={material.id} className="hover:bg-slate-50">
                            <td className="px-5 py-4">
                              <p className="font-extrabold text-[#0b1c30]">{material.name}</p>
                              <p className="text-xs font-semibold text-slate-400">
                                SKU: {material.sku}
                              </p>
                            </td>
                            <td className="px-5 py-4 font-bold text-slate-600">
                              {material.category || "Chưa phân loại"}
                            </td>
                            <td className="px-5 py-4 font-bold text-slate-600">
                              {material.unit}
                            </td>
                            <td className="px-5 py-4 text-right font-extrabold text-[#0b1c30]">
                              {formatCurrency(material.importPrice)}
                            </td>
                            <td className="px-5 py-4 text-slate-500">
                              {material.supplierName || "Chưa liên kết"}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={[
                                  "inline-flex px-2 py-1 text-xs font-extrabold rounded",
                                  material.isActive
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50 text-rose-600",
                                ].join(" ")}
                              >
                                {material.isActive ? "Hoạt động" : "Ngừng hoạt động"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMaterial(material);
                                  setShowMaterialModal(true);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                                aria-label="Sửa nguyên liệu"
                              >
                                <Icon name="edit" className="text-sm" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteMaterial(material)}
                                className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 hover:border-rose-500 hover:text-rose-500"
                                aria-label="Xóa nguyên liệu"
                              >
                                <Icon name="delete" className="text-sm" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {materials.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-10 text-center text-sm font-bold text-slate-400"
                        >
                          Chưa có nguyên liệu nào phù hợp.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            </>
          ) : currentTab === "suppliers" ? (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <StatCard
                  icon="storefront"
                  label="Tổng nhà cung cấp"
                  value={String(suppliers.length)}
                  tone="bg-blue-50 text-blue-600"
                />
                <StatCard
                  icon="receipt_long"
                  label="Phiếu nhập có NCC"
                  value={String(receipts.filter((receipt) => receipt.supplierId).length)}
                  tone="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  icon="trending_down"
                  label="Công nợ NCC"
                  value={formatCurrency(receiptSummary.debtAmount)}
                  tone="bg-amber-50 text-amber-600"
                />
              </section>

              <section className="border border-slate-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Tìm tên nhà cung cấp, người liên hệ, số điện thoại..."
                      className="h-10 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#f97316]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSupplier(null);
                      setShowSupplierModal(true);
                    }}
                    className="h-10 border border-slate-200 bg-white text-sm font-extrabold text-slate-600 hover:border-[#f97316] hover:text-[#f97316] flex items-center justify-center gap-1"
                  >
                    <Icon name="add" className="text-sm" />
                    Thêm NCC
                  </button>
                </div>
              </section>

              <section className="overflow-x-auto border border-slate-200 bg-white">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-4">Nhà cung cấp</th>
                      <th className="px-5 py-4">Người liên hệ</th>
                      <th className="px-5 py-4">Điện thoại</th>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Địa chỉ</th>
                      <th className="px-5 py-4 text-right">Số phiếu nhập</th>
                      <th className="px-5 py-4 text-right">Công nợ</th>
                      <th className="px-5 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers
                      .filter((supplier) => {
                        const query = normalizeText(searchQuery);
                        const text = normalizeText(
                          `${supplier.name} ${supplier.contactName || ""} ${supplier.phone || ""} ${supplier.email || ""}`
                        );

                        return !query || text.includes(query);
                      })
                      .map((supplier) => {
                        const supplierReceipts = receipts.filter(
                          (receipt) => receipt.supplierId === supplier.id
                        );
                        const supplierDebt = supplierReceipts.reduce((sum, receipt) => {
                          const total = Number(receipt.totalAmount || 0);
                          return sum + Math.max(total - getPaidAmount(receipt), 0);
                        }, 0);

                        return (
                          <tr key={supplier.id} className="hover:bg-slate-50">
                            <td className="px-5 py-4">
                              <p className="font-extrabold text-[#0b1c30]">{supplier.name}</p>
                              <p className="text-xs font-semibold text-slate-400">
                                ID: {supplier.id.slice(0, 8).toUpperCase()}
                              </p>
                            </td>
                            <td className="px-5 py-4 font-bold text-slate-600">
                              {supplier.contactName || "Chưa lưu"}
                            </td>
                            <td className="px-5 py-4 font-bold text-slate-600">
                              {supplier.phone}
                            </td>
                            <td className="px-5 py-4 text-slate-500">
                              {supplier.email || "Trong"}
                            </td>
                            <td className="max-w-[240px] truncate px-5 py-4 text-slate-500">
                              {supplier.address || "Trong"}
                            </td>
                            <td className="px-5 py-4 text-right font-extrabold text-[#0b1c30]">
                              {supplierReceipts.length}
                            </td>
                            <td className="px-5 py-4 text-right font-extrabold text-amber-600">
                              {formatCurrency(supplierDebt)}
                            </td>
                            <td className="px-5 py-4 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupplier(supplier);
                                  setShowSupplierModal(true);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                                aria-label="Sửa nhà cung cấp"
                              >
                                <Icon name="edit" className="text-sm" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteSupplier(supplier)}
                                className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 hover:border-rose-500 hover:text-rose-500"
                                aria-label="Xóa nhà cung cấp"
                              >
                                <Icon name="delete" className="text-sm" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {suppliers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-5 py-10 text-center text-sm font-bold text-slate-400"
                        >
                          Chưa có nhà cung cấp nào.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            </>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon="local_shipping"
                  label="Tổng giá trị nhập"
                  value={formatCurrency(receiptSummary.totalAmount)}
                  tone="bg-blue-50 text-blue-600"
                />
                <StatCard
                  icon="attach_money"
                  label="Đã chi thanh toán"
                  value={formatCurrency(receiptSummary.paidAmount)}
                  tone="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  icon="trending_down"
                  label="Công nợ NCC còn lạiC"
                  value={formatCurrency(receiptSummary.debtAmount)}
                  tone="bg-slate-50 text-slate-500"
                />
                <StatCard
                  icon="shield"
                  label="Tổng số phiếu nhập"
                  value={String(receipts.length)}
                  tone="bg-indigo-50 text-indigo-600"
                />
              </section>

              <section className="flex flex-col gap-4 border-b border-slate-200 pb-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                    Thanh toán:
                  </span>
                  {paymentTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setPaymentFilter(tab.key)}
                      className={[
                        "h-9 border px-4 text-xs font-extrabold transition-colors",
                        paymentFilter === tab.key
                          ? "border-[#f97316] bg-[#f97316] text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#f97316] hover:text-[#f97316]",
                      ].join(" ")}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="h-9 border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
                  />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="h-9 border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
                  />
                </div>
              </section>

              <section className="border border-slate-200 bg-white p-4">
                <div className="grid gap-3 lg:grid-cols-[290px_1fr_160px]">
                  <select
                    value={supplierFilter}
                    onChange={(event) => setSupplierFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option value="all">Tất cả nhà cung cấp</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Tìm mã phiếu, nhà cung cấp, ghi chú..."
                      className="h-10 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#f97316]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSupplier(null);
                      setShowSupplierModal(true);
                    }}
                    className="h-10 border border-slate-200 bg-white text-sm font-extrabold text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                  >
                    Thêm NCC
                  </button>
                </div>
              </section>

              <section className="overflow-x-auto border border-slate-200 bg-white">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-4">Mã phiếu</th>
                      <th className="px-5 py-4">Nhà cung cấp</th>
                      <th className="px-5 py-4 text-right">ổng tiền hàng</th>
                      <th className="px-5 py-4 text-right">Đã thanh toán</th>
                      <th className="px-5 py-4">Trạng thái thanh toán</th>
                      <th className="px-5 py-4">Ngày nhập</th>
                      <th className="px-5 py-4">Người lập phiếu</th>
                      <th className="px-5 py-4 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceipts.map((receipt) => {
                      const paid = getPaidAmount(receipt);
                      const status = getPaymentStatus(receipt);

                      return (
                        <tr key={receipt.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <p className="inline-block bg-slate-50 px-2 py-1 text-xs font-extrabold text-[#0b1c30]">
                              {getReceiptCode(receipt)}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-extrabold text-[#0b1c30]">
                              {receipt.supplierName || "Không có NCC"}
                            </p>
                            <p className="max-w-[240px] truncate text-xs font-semibold text-slate-400">
                              {getReceiptDetails(receipt)}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-right font-extrabold text-[#0b1c30]">
                            {formatCurrency(receipt.totalAmount)}
                          </td>
                          <td className="px-5 py-4 text-right font-extrabold text-emerald-600">
                            {formatCurrency(Math.min(paid, receipt.totalAmount))}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex px-3 py-1 text-xs font-extrabold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs font-bold text-slate-500">
                            {formatDateTime(receipt.createdAt)}
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-600">
                            {receipt.createdByName || "Quản trị hệ thống"}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedReceipt(receipt);
                                setShowReceiptDetailsModal(true);
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-600 hover:border-[#f97316] hover:text-[#f97316]"
                              aria-label="Xem chi tiết"
                            >
                              <Icon name="visibility" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-5 py-10 text-center text-sm font-bold text-slate-400"
                        >
                          Chưa có phiếu nhập phù hợp.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      )}

      {showSupplierModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleSaveSupplier}
            className="w-full max-w-md bg-white p-6 shadow-2xl"
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
                    title="Số điện thoại phải gồm đúng 10 chữ số"
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
                  placeholder="Hồ Chí Minh"
                  defaultValue={editingSupplier?.address || ""}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierModal(false);
                    setEditingSupplier(null);
                  }}
                  className="h-10 flex-1 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 flex-1 bg-[#f97316] text-xs font-bold text-white hover:bg-[#ea580c] disabled:bg-slate-300"
                >
                  {isSubmitting ? "Đang xử lý..." : editingSupplier ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {showMaterialModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleAddMaterial}
            className="w-full max-w-md bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-[#0b1c30]">
                {editingMaterial ? "Sửa nguyên liệu" : "Thêm nguyên liệu mới"}
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
                <label className={labelClass}>Tên nguyên liệu *</label>
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
                <label className={labelClass}>Mã nguyên liệu / SKU</label>
                <input
                  name="sku"
                  type="text"
                  placeholder="VD: NL-CAFE"
                  defaultValue={editingMaterial?.sku || ""}
                  disabled={!!editingMaterial}
                  className={inputClass}
                />
                {editingMaterial && (
                  <p className="mt-1 text-[11px] text-slate-400 font-semibold">
                    Không thể thay đổi mã SKU của nguyên liệu đã tạo.
                  </p>
                )}
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
                    placeholder="VD: kg, lon, túi"
                    defaultValue={editingMaterial?.unit || ""}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Giá nhập mặc định *</label>
                  <input
                    required
                    name="importPrice"
                    type="number"
                    min={0}
                    defaultValue={editingMaterial?.importPrice ?? 0}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Trạng thái</label>
                  <select
                    name="status"
                    defaultValue={editingMaterial ? (editingMaterial.isActive ? "active" : "inactive") : "active"}
                    className={inputClass}
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Nhà cung cấp mặc định</label>
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
                  className="h-10 flex-1 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 flex-1 bg-[#f97316] text-xs font-bold text-white hover:bg-[#ea580c] disabled:bg-slate-300"
                >
                  {isSubmitting ? "Đang xử lý..." : editingMaterial ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {showReceiptDetailsModal && selectedReceipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-[#0b1c30] flex items-center gap-2">
                <Icon name="receipt_long" className="text-[#f97316]" />
                Chi tiết phiếu nhập: {getReceiptCode(selectedReceipt)}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowReceiptDetailsModal(false);
                  setSelectedReceipt(null);
                }}
                className="p-1 text-slate-400 hover:bg-slate-100"
              >
                <Icon name="close" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600 mb-6 bg-slate-50 p-4 border border-slate-100">
              <div>
                <p className="text-slate-400 uppercase text-[10px] tracking-wider mb-1">Nhà cung cấp</p>
                <p className="text-[#0b1c30] font-bold text-sm">{selectedReceipt.supplierName || "Không có NCC"}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase text-[10px] tracking-wider mb-1">Ngày nhập</p>
                <p className="text-[#0b1c30] font-bold text-sm">{formatDateTime(selectedReceipt.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase text-[10px] tracking-wider mb-1">Người lập phiếu</p>
                <p className="text-[#0b1c30] font-bold text-sm">{selectedReceipt.createdByName || "Quản trị hệ thống"}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase text-[10px] tracking-wider mb-1">Trạng thái thanh toán</p>
                <span className={`inline-flex px-2 py-0.5 text-xs font-extrabold ${getPaymentStatus(selectedReceipt).className}`}>
                  {getPaymentStatus(selectedReceipt).label}
                </span>
              </div>
              {getDisplayNote(selectedReceipt.note) && (
                <div className="col-span-2 border-t border-slate-200/60 pt-2 mt-1">
                  <p className="text-slate-400 uppercase text-[10px] tracking-wider mb-1">Ghi chú</p>
                  <p className="text-[#0b1c30] whitespace-pre-wrap">{getDisplayNote(selectedReceipt.note)}</p>
                </div>
              )}
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2">Nguyên liệu</th>
                    <th className="w-20 py-2 text-center">Số lượng</th>
                    <th className="w-28 py-2 text-right">Đơn giá</th>
                    <th className="w-28 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                  {Array.isArray(selectedReceipt.materialDetails) && selectedReceipt.materialDetails.length > 0 ? (
                    selectedReceipt.materialDetails.map((detail) => (
                      <tr key={detail.id}>
                        <td className="py-3">
                          <p className="font-extrabold text-[#0b1c30]">{detail.materialName}</p>
                          <p className="text-[11px] text-slate-400">SKU: {detail.materialId.slice(0, 8).toUpperCase()} - Đơn vị: {detail.unit}</p>
                        </td>
                        <td className="py-3 text-center">{detail.quantity}</td>
                        <td className="py-3 text-right">{formatCurrency(detail.unitPrice)}</td>
                        <td className="py-3 text-right font-bold text-[#0b1c30]">{formatCurrency(detail.lineTotal)}</td>
                      </tr>
                    ))
                  ) : Array.isArray(selectedReceipt.details) && selectedReceipt.details.length > 0 ? (
                    selectedReceipt.details.map((detail) => (
                      <tr key={detail.id}>
                        <td className="py-3">
                          <p className="font-extrabold text-[#0b1c30]">{detail.productName}</p>
                        </td>
                        <td className="py-3 text-center">{detail.quantity}</td>
                        <td className="py-3 text-right">{formatCurrency(detail.unitPrice)}</td>
                        <td className="py-3 text-right font-bold text-[#0b1c30]">{formatCurrency(detail.lineTotal)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 font-bold">Không tìm thấy chi tiết nguyên liệu.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2 text-sm font-extrabold">
              <div className="flex justify-between">
                <span className="text-slate-500">Tổng tiền hàng:</span>
                <span>{formatCurrency(selectedReceipt.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Đã thanh toán:</span>
                <span className="text-emerald-600">{formatCurrency(getPaidAmount(selectedReceipt))}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-3 text-base">
                <span className="text-[#0b1c30]">Còn nợ nhà cung cấp:</span>
                <span className={selectedReceipt.totalAmount - getPaidAmount(selectedReceipt) > 0 ? "text-rose-600" : "text-emerald-600"}>
                  {formatCurrency(Math.max(selectedReceipt.totalAmount - getPaidAmount(selectedReceipt), 0))}
                </span>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 pt-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowReceiptDetailsModal(false);
                  setSelectedReceipt(null);
                }}
                className="h-10 w-full bg-[#f97316] text-xs font-bold text-white hover:bg-[#ea6c0a]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
