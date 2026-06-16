import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { getProducts, type Product } from "../../api/product.api";
import {
  fetchSuppliers,
  createSupplier,
  fetchGoodsReceipts,
  createGoodsReceipt,
  type Supplier,
  type GoodsReceipt,
} from "../../api/inventory.api";

// Custom styles
const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-semibold outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100";
const selectClass = "w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-semibold outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100";

// Helper function to return dynamic Vietnamese units based on category and name
export function getProductUnit(categoryName: string, productName: string): string {
  const cat = (categoryName || "").toLowerCase();
  const name = (productName || "").toLowerCase();

  if (cat.includes("bánh mì")) return "ổ";
  if (cat.includes("xôi") || cat.includes("cơm")) return "phần";
  if (cat.includes("bún") || cat.includes("phở") || cat.includes("nước") || cat.includes("mì")) {
    if (name.includes("lẩu")) return "nồi";
    return "tô";
  }
  if (cat.includes("cà phê") || cat.includes("trà") || cat.includes("sữa")) return "ly";
  if (cat.includes("giải khát") || cat.includes("nước ép") || cat.includes("nước ngọt")) {
    if (name.includes("lon")) return "lon";
    if (name.includes("chai") || name.includes("suối") || name.includes("aquafina")) return "chai";
    return "ly";
  }
  return "cái";
}

export function StockPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract submenu from path, default to import
  const pathParts = location.pathname.split("/");
  const currentTab = pathParts[2] || "import";

  // State Management
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Form State for creating goods receipt directly in the tab
  const [formSupplierId, setFormSupplierId] = useState<string>("");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState<string>("");
  const [formCreatedAt, setFormCreatedAt] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [formTotalAmount, setFormTotalAmount] = useState<string>("");
  const [formDetails, setFormDetails] = useState<string>("");
  const [formNote, setFormNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Supplier modal state
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Load Data
  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [prodRes, supRes, recRes] = await Promise.all([
        getProducts(),
        fetchSuppliers(),
        fetchGoodsReceipts(),
      ]);

      setProducts(prodRes.data);
      setSuppliers(supRes.data);
      setReceipts(recRes.data);

      if (supRes.data.length > 0 && !formSupplierId) {
        setFormSupplierId(supRes.data[0].id);
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu kho:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Formatter helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0
    }).format(val);
  };

  // Submit Goods Receipt
  const handleCreateReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId) {
      alert("Vui lòng chọn nhà cung cấp!");
      return;
    }

    const totalVal = Number(formTotalAmount);
    if (isNaN(totalVal) || totalVal < 0) {
      alert("Vui lòng nhập tổng tiền hợp lệ (lớn hơn hoặc bằng 0)!");
      return;
    }

    if (!formDetails.trim()) {
      alert("Vui lòng nhập chi tiết hàng hóa nhập!");
      return;
    }

    // Compile the custom fields into note format
    let fullNote = "";
    if (formInvoiceNumber.trim()) {
      fullNote += `Số hóa đơn/Mã đơn: ${formInvoiceNumber.trim()}\n`;
    }
    fullNote += `Chi tiết hàng hóa nhập:\n${formDetails.trim()}`;
    if (formNote.trim()) {
      fullNote += `\n\nGhi chú: ${formNote.trim()}`;
    }

    try {
      setIsSubmitting(true);
      await createGoodsReceipt({
        supplierId: formSupplierId,
        note: fullNote,
        totalAmount: totalVal,
        createdAt: formCreatedAt, // Custom import date
        items: [] // empty list so it only logs raw materials metadata
      });

      alert("Lưu phiếu nhập hàng thành công!");
      // Reset form
      setFormTotalAmount("");
      setFormInvoiceNumber("");
      setFormDetails("");
      setFormNote("");
      // Reset date to today
      const today = new Date();
      setFormCreatedAt(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);

      // Reload and redirect to Lịch sử nhập hàng
      await loadAllData();
      navigate("/stock/history");
    } catch (error: any) {
      alert(error.message || "Lưu phiếu nhập thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Supplier to API
  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await createSupplier({
        name: String(formData.get("name")),
        contactName: String(formData.get("contact") || ""),
        phone: String(formData.get("phone")),
        email: String(formData.get("email") || ""),
        address: String(formData.get("address") || "")
      });

      alert("Thêm nhà cung cấp mới thành công!");
      setShowSupplierModal(false);
      await loadAllData(); // reload
    } catch (error: any) {
      alert(error.message || "Thêm nhà cung cấp thất bại");
    }
  };

  // Submenu configuration
  const subMenus = [
    { key: "import", label: "Phiếu nhập hàng", icon: "download" },
    { key: "suppliers", label: "Nhà cung cấp", icon: "local_shipping" },
    { key: "history", label: "Lịch sử nhập hàng", icon: "history" },
  ];

  return (
    <AdminLayout
      title="Kho hàng"
      subtitle="Hệ thống quản lý chuỗi cung ứng, nhà cung cấp và ghi nhận phiếu nhập kho."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">

        {/* Left inner tab-navigation */}
        <aside className="flex flex-col gap-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm h-fit">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Chức năng kho
          </p>
          {subMenus.map((menu) => {
            const isActive = currentTab === menu.key;
            return (
              <button
                key={menu.key}
                type="button"
                onClick={() => {
                  navigate(`/stock/${menu.key}`);
                  setSearchQuery("");
                }}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-[#f97316] text-white shadow-sm"
                    : "text-slate-600 hover:bg-orange-50 hover:text-[#f97316]"
                ].join(" ")}
              >
                <Icon name={menu.icon} className="text-[18px]" />
                <span className="flex-1 truncate">{menu.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Content Area */}
        <div className="flex flex-col gap-6">

          {/* Active section header */}
          <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-[#0b1c30] capitalize">
                {subMenus.find(m => m.key === currentTab)?.label ?? "Kho hàng"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {currentTab === "import" && "Lập phiếu ghi nhận nguyên vật liệu nhập từ đối tác cung cấp."}
                {currentTab === "suppliers" && "Danh sách đối tác cung cấp nguyên liệu thô và sản phẩm đóng gói."}
                {currentTab === "history" && "Xem nhật ký toàn bộ các phiếu nhập kho đã thực hiện thành công."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {(currentTab === "suppliers" || currentTab === "history") && (
                <div className="relative">
                  <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm nhanh..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-xs font-semibold outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              )}

              {currentTab === "suppliers" && (
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#f97316] px-4 text-xs font-extrabold text-white transition-colors hover:bg-[#ea580c] shadow-sm"
                >
                  <Icon name="add" className="text-sm" />
                  Thêm nhà CC
                </button>
              )}
            </div>
          </section>

          {/* Section Main Content */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-400">
                Đang tải dữ liệu hệ thống...
              </div>
            ) : (
              <>
                {/* PHIẾU NHẬP HÀNG (TRỰC TIẾP FORM LẬP PHIẾU THEO ĐỀ XUẤT) */}
                {currentTab === "import" && (
                  <div className="p-6 max-w-xl">
                    <form onSubmit={handleCreateReceiptSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Nhà cung cấp *
                          </label>
                          <select
                            value={formSupplierId}
                            onChange={(e) => setFormSupplierId(e.target.value)}
                            className={selectClass}
                            required
                          >
                            <option value="">-- Chọn nhà cung cấp --</option>
                            {suppliers.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Số hóa đơn / Mã đơn hàng
                          </label>
                          <input
                            type="text"
                            value={formInvoiceNumber}
                            onChange={(e) => setFormInvoiceNumber(e.target.value)}
                            placeholder="Ví dụ: HD-2026-00125"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Ngày nhập hàng *
                          </label>
                          <input
                            type="date"
                            value={formCreatedAt}
                            onChange={(e) => setFormCreatedAt(e.target.value)}
                            className={inputClass}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Tổng tiền (VNĐ) *
                          </label>
                          <input
                            type="number"
                            value={formTotalAmount}
                            onChange={(e) => setFormTotalAmount(e.target.value)}
                            placeholder="Ví dụ: 3500000"
                            className={inputClass}
                            min={0}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Chi tiết hàng hóa nhập *
                        </label>
                        <textarea
                          value={formDetails}
                          onChange={(e) => setFormDetails(e.target.value)}
                          placeholder="Nhập nguyên liệu và số lượng tương ứng (ví dụ: Tôm 1kg, Sữa 1L, Cà phê 500g...)"
                          rows={6}
                          className={[inputClass, "font-mono text-xs leading-relaxed"].join(" ")}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Ghi chú
                        </label>
                        <textarea
                          value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          placeholder="Ghi nhận thêm thông tin khác (nếu có)..."
                          rows={3}
                          className={inputClass}
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#f97316] text-xs font-extrabold text-white transition-colors hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          <Icon name="check" className="text-sm" />
                          {isSubmitting ? "Đang lưu..." : "Lưu phiếu nhập hàng"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* LỊCH SỬ NHẬP HÀNG */}
                {currentTab === "history" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Mã phiếu</th>
                          <th className="px-6 py-4">Nhà cung cấp</th>
                          <th className="px-6 py-4">Ngày nhập</th>
                          <th className="px-6 py-4 text-right">Tổng tiền</th>
                          <th className="px-6 py-4">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {receipts
                          .filter(t => {
                            return searchQuery === "" ||
                              t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (t.supplierName && t.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                              (t.note && t.note.toLowerCase().includes(searchQuery.toLowerCase()));
                          })
                          .map(t => {
                            // If the receipt has product details, map them. Otherwise, display the notes containing the formatted raw materials list
                            const hasDetails = Array.isArray(t.details) && t.details.length > 0;
                            const detailsText = hasDetails
                              ? t.details
                                ?.map(d => {
                                  const prod = products.find(p => p.id === d.productId);
                                  const unit = getProductUnit(prod?.categoryName || "", d.productName);
                                  return `${d.productName} (x${d.quantity} ${unit})`;
                                })
                                .join(", ")
                              : t.note || "Nhập nguyên liệu";

                            return (
                              <tr key={t.id} className="transition-colors hover:bg-slate-50/50">
                                <td className="px-6 py-4 text-slate-500 font-bold text-xs">{t.id.substring(0, 8).toUpperCase()}</td>
                                <td className="px-6 py-4 text-[#0b1c30] font-extrabold">{t.supplierName || "Vãng lai"}</td>
                                <td className="px-6 py-4 text-xs font-semibold text-slate-400">
                                  {new Date(t.createdAt).toLocaleString("vi-VN", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </td>
                                <td className="px-6 py-4 text-right font-extrabold text-green-600">
                                  {formatCurrency(t.totalAmount)}
                                </td>
                                <td className="px-6 py-4 max-w-[320px] text-slate-600 font-semibold">
                                  <div className="whitespace-pre-line text-xs">
                                    {detailsText}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {receipts.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                              Chưa có phiếu nhập kho nào.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* NHÀ CUNG CẤP */}
                {currentTab === "suppliers" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Nhà cung cấp</th>
                          <th className="px-6 py-4">Người liên hệ</th>
                          <th className="px-6 py-4">Điện thoại</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Địa chỉ</th>
                          <th className="px-6 py-4 text-right">Trạng thái công nợ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {suppliers
                          .filter(s => searchQuery === "" || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(s => (
                            <tr key={s.id} className="transition-colors hover:bg-slate-50/50">
                              <td className="px-6 py-4 text-[#0b1c30] font-extrabold">{s.name}</td>
                              <td className="px-6 py-4">{s.contactName || "Chưa lưu"}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-600">{s.phone}</td>
                              <td className="px-6 py-4 text-xs font-semibold text-slate-500">{s.email || "Trống"}</td>
                              <td className="px-6 py-4 max-w-[200px] truncate text-slate-500" title={s.address || ""}>
                                {s.address || "Trống"}
                              </td>
                              <td className="px-6 py-4 text-right font-extrabold text-green-600">
                                Sạch nợ
                              </td>
                            </tr>
                          ))}
                        {suppliers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              Chưa có đối tác nhà cung cấp nào. Click "Thêm nhà CC" để tạo mới.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

      </div>

      {/* SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fade-in">
          <form onSubmit={handleAddSupplier} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-[#0b1c30]">Thêm nhà cung cấp mới</h2>
              <button type="button" onClick={() => setShowSupplierModal(false)} className="rounded-lg p-1 hover:bg-slate-100 text-slate-400">
                <Icon name="close" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tên nhà cung cấp *</label>
                <input required name="name" type="text" placeholder="Nhà cung cấp A" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Người liên hệ</label>
                <input name="contact" type="text" placeholder="Anh B" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Số điện thoại *</label>
                  <input required name="phone" type="text" placeholder="090..." className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Email</label>
                  <input name="email" type="email" placeholder="example@mail.com" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Địa chỉ</label>
                <input name="address" type="text" placeholder="Hồ Chí Minh" className={inputClass} />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-[#f97316] text-xs font-bold text-white hover:bg-[#ea580c] shadow-sm"
                >
                  Thêm mới
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
