import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import {
  type Promotion,
  type PromotionFormData,
  createPromotion,
  deletePromotion,
  fetchPromotions,
  togglePromotion,
  updatePromotion,
} from "../../api/promotions.api";
import { getProducts, type Product } from "../../api/product.api";

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function isExpired(endAt: string | null) {
  if (!endAt) return false;
  return new Date(endAt) < new Date();
}

function isUpcoming(startAt: string | null) {
  if (!startAt) return false;
  return new Date(startAt) > new Date();
}

// ─── Stat Card ────────────────────────────────────────────────
type StatCardProps = {
  label: string;
  value: string | number;
  icon: string;
  accent: string;
};

function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div className="border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center"
          style={{ background: accent + "18", color: accent }}
        >
          <Icon name={icon} className="text-[18px]" />
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
      </div>
      <p className="text-3xl font-extrabold text-[#0b1c30]">{value}</p>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────
function StatusBadge({ promotion }: { promotion: Promotion }) {
  if (!promotion.isActive) {
    return (
      <span className="border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
        Tắt
      </span>
    );
  }
  if (isExpired(promotion.endAt)) {
    return (
      <span className="border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
        Hết hạn
      </span>
    );
  }
  if (isUpcoming(promotion.startAt)) {
    return (
      <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
        Sắp diễn ra
      </span>
    );
  }
  return (
    <span className="border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
      Đang hoạt động
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center bg-orange-50 text-[#f97316]">
        <Icon name="redeem" className="text-4xl" />
      </div>
      <p className="mb-1 text-lg font-bold text-[#0b1c30]">
        Chưa có khuyến mãi nào
      </p>
      <p className="mb-6 text-sm text-slate-500">
        Tạo mã giảm giá đầu tiên để áp dụng khi bán hàng tại quầy
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="hidden"
      >
        <Icon name="add" />
        Tạo khuyến mãi
      </button>
    </div>
  );
}

// ─── Modal Form ───────────────────────────────────────────────
type ModalProps = {
  editing: Promotion | null;
  products: Product[];
  onClose: () => void;
  onSaved: (p: Promotion) => void;
};

const EMPTY_FORM: PromotionFormData = {
  productId: "",
  code: "",
  name: "",
  discountType: "percent",
  discountValue: 10,
  startAt: "",
  endAt: "",
  isActive: true,
};

function PromotionModal({ editing, products, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<PromotionFormData>(() =>
    editing
      ? {
          productId: editing.productId,
          code: editing.code,
          name: editing.name,
          discountType: editing.discountType,
          discountValue: editing.discountValue,
          startAt: toInputDate(editing.startAt),
          endAt: toInputDate(editing.endAt),
          isActive: editing.isActive,
        }
      : { ...EMPTY_FORM, productId: products[0]?.id ?? "" }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  function setField<K extends keyof PromotionFormData>(
    key: K,
    value: PromotionFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let saved: Promotion;
      if (editing) {
        saved = await updatePromotion(editing.id, form);
      } else {
        saved = await createPromotion(form);
      }
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#f97316]">
              {editing ? "Chỉnh sửa" : "Tạo mới"}
            </p>
            <h2 className="text-lg font-extrabold text-[#0b1c30]">
              {editing ? "Cập nhật khuyến mãi" : "Tạo khuyến mãi"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Sản phẩm áp dụng <span className="text-red-500">*</span>
            </label>
            <select
              value={form.productId}
              onChange={(e) => setField("productId", e.target.value)}
              required
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
            >
              <option value="">Chọn sản phẩm</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.sku}
                </option>
              ))}
            </select>
          </div>

          {/* Code */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Mã khuyến mãi <span className="text-red-500">*</span>
            </label>
            <input
              ref={codeRef}
              type="text"
              value={form.code}
              onChange={(e) => setField("code", e.target.value.toUpperCase())}
              placeholder="VD: SALE20, WELCOME10"
              maxLength={30}
              required
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono font-semibold uppercase text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
            />
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Tên chương trình <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="VD: Giảm 20% khai trương"
              required
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
            />
          </div>

          {/* Discount type + value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Loại giảm <span className="text-red-500">*</span>
              </label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setField(
                    "discountType",
                    e.target.value as "percent" | "fixed"
                  )
                }
                className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
              >
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Cố định (VNĐ)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Giá trị <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={form.discountType === "percent" ? 100 : undefined}
                  step={form.discountType === "percent" ? 1 : 1000}
                  value={form.discountValue}
                  onChange={(e) =>
                    setField("discountValue", Number(e.target.value))
                  }
                  required
                  className="w-full border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-sm text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {form.discountType === "percent" ? "%" : "đ"}
                </span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Bắt đầu
              </label>
              <input
                type="date"
                value={form.startAt}
                onChange={(e) => setField("startAt", e.target.value)}
                className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                Kết thúc
              </label>
              <input
                type="date"
                value={form.endAt}
                onChange={(e) => setField("endAt", e.target.value)}
                className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
              />
            </div>
          </div>

          {/* Active toggle (only on edit) */}
          {editing && (
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                />
                <div
                  className={`h-5 w-9 transition-colors ${form.isActive ? "bg-[#f97316]" : "bg-slate-300"}`}
                />
                <div
                  className={`absolute top-0.5 h-4 w-4 bg-white shadow transition-all ${form.isActive ? "left-4" : "left-0.5"}`}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                Đang hoạt động
              </span>
            </label>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 bg-[#f97316] px-4 text-sm font-bold text-white transition-colors hover:bg-[#ea580c] disabled:opacity-60"
            >
              {loading && (
                <Icon name="progress_activity" className="animate-spin text-base" />
              )}
              {editing ? "Lưu thay đổi" : "Tạo khuyến mãi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────
function DeleteConfirm({
  promotion,
  onClose,
  onDeleted,
}: {
  promotion: Promotion;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    try {
      await deletePromotion(promotion.id);
      onDeleted(promotion.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500">
            Xác nhận xoá
          </p>
          <h2 className="text-lg font-extrabold text-[#0b1c30]">Xoá khuyến mãi</h2>
        </div>
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}
          <p className="mb-1 text-sm text-slate-700">
            Bạn sắp xoá mã khuyến mãi:
          </p>
          <p className="mb-4 font-mono text-base font-extrabold text-[#0b1c30]">
            {promotion.code}
          </p>
          <p className="text-sm text-slate-500">
            Thao tác này không thể hoàn tác.
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {loading && (
              <Icon name="progress_activity" className="animate-spin text-base" />
            )}
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);


  // Khởi tạo bằng lazy initializer — chỉ chạy 1 lần khi mount, không tính là gọi trong render
  const [now] = useState(() => Date.now());

  useEffect(() => {
    // Tất cả setState gọi trong callbacks (.then/.catch/.finally), không đồng bộ
    Promise.all([fetchPromotions(), getProducts()])
      .then(([data, productResponse]) => {
        setPromotions(data);
        setProducts(productResponse.data);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promotions;
    return promotions.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q)
    );
  }, [promotions, search]);

  // Stats
  const stats = useMemo(() => {
    const active = promotions.filter(
      (p) => p.isActive && !isExpired(p.endAt) && !isUpcoming(p.startAt)
    ).length;
    const expiringSoon = promotions.filter((p) => {
      if (!p.isActive || !p.endAt) return false;
      const diff =
        (new Date(p.endAt).getTime() - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    const expired = promotions.filter((p) => isExpired(p.endAt)).length;
    return { total: promotions.length, active, expiringSoon, expired };
  }, [promotions, now]);

  function openAdd() {
    setEditingPromotion(null);
    setShowModal(true);
  }

  function openEdit(p: Promotion) {
    setEditingPromotion(p);
    setShowModal(true);
  }

  function handleSaved(saved: Promotion) {
    setPromotions((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowModal(false);
  }

  function handleDeleted(id: string) {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    setDeletingPromotion(null);
  }

  async function handleToggle(p: Promotion) {
    setTogglingId(p.id);
    try {
      const updated = await togglePromotion(p.id);
      setPromotions((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <AdminLayout title="Khuyến mãi" subtitle="Quản lý mã giảm giá và chương trình ưu đãi tại quầy">
      {/* ── Header ── */}
      <div className="mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#f97316]">
            Ưu đãi bán hàng
          </p>
          <h1 className="text-2xl font-extrabold text-[#0b1c30]">
            Danh sách khuyến mãi
          </h1>
        </div>
        <button
          type="button"
          id="btn-add-promotion"
          onClick={openAdd}
          className="hidden"
        >
          <Icon name="add" />
          Tạo khuyến mãi
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Tổng mã"
          value={stats.total}
          icon="redeem"
          accent="#f97316"
        />
        <StatCard
          label="Đang hoạt động"
          value={stats.active}
          icon="check_circle"
          accent="#16a34a"
        />
        <StatCard
          label="Sắp hết hạn (7 ngày)"
          value={stats.expiringSoon}
          icon="schedule"
          accent="#d97706"
        />
        <StatCard
          label="Đã hết hạn"
          value={stats.expired}
          icon="event_busy"
          accent="#dc2626"
        />
      </div>

      {/* ── Table card ── */}
      <div className="border border-slate-200 bg-white">
        {/* Search bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã hoặc tên khuyến mãi..."
              className="w-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-[#0b1c30] outline-none transition-colors focus:border-[#f97316] focus:bg-white"
            />
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 bg-[#f97316] px-4 text-sm font-bold text-white transition-colors hover:bg-[#ea580c]"
          >
            <Icon name="add" />
            Tạo khuyến mãi
          </button>
          <span className="hidden">
            {filtered.length} kết quả
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Icon name="progress_activity" className="animate-spin text-3xl" />
            <span className="ml-2 text-sm font-semibold">Đang tải...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && promotions.length === 0 && (
          <EmptyState onAdd={openAdd} />
        )}

        {/* Table */}
        {!loading && promotions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Mã
                  </th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Tên chương trình
                  </th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Loại giảm
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Giá trị
                  </th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Thời hạn
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                    Trạng thái
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                    Bật/Tắt
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-sm font-semibold text-slate-400"
                    >
                      Không có kết quả phù hợp
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-slate-50"
                    >
                      {/* Code */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-sm font-extrabold tracking-wider text-[#0b1c30]">
                          {p.code}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-[#0b1c30]">
                          {p.name}
                        </span>
                      </td>

                      {/* Discount type */}
                      <td className="px-5 py-3.5">
                        <span className="text-slate-600">
                          {p.discountType === "percent"
                            ? "Phần trăm"
                            : "Cố định"}
                        </span>
                      </td>

                      {/* Discount value */}
                      <td className="px-5 py-3.5 text-right font-extrabold text-[#f97316]">
                        {p.discountType === "percent"
                          ? `${p.discountValue}%`
                          : `${p.discountValue.toLocaleString("vi-VN")} đ`}
                      </td>

                      {/* Dates */}
                      <td className="px-5 py-3.5">
                        <div className="text-xs text-slate-600">
                          <span>{formatDate(p.startAt)}</span>
                          <span className="mx-1 text-slate-300">→</span>
                          <span>{formatDate(p.endAt)}</span>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge promotion={p} />
                      </td>

                      {/* Toggle */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(p)}
                          disabled={togglingId === p.id}
                          title={p.isActive ? "Tắt" : "Bật"}
                          className={`relative inline-flex h-5 w-9 items-center transition-colors disabled:opacity-50 ${p.isActive ? "bg-[#f97316]" : "bg-slate-300"}`}
                        >
                          <span
                            className={`absolute h-4 w-4 bg-white shadow transition-all ${p.isActive ? "left-4" : "left-0.5"}`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            title="Chỉnh sửa"
                            className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#f97316]"
                          >
                            <Icon name="edit" className="text-[18px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPromotion(p)}
                            title="Xoá"
                            className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showModal && (
        <PromotionModal
          editing={editingPromotion}
          products={products}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {deletingPromotion && (
        <DeleteConfirm
          promotion={deletingPromotion}
          onClose={() => setDeletingPromotion(null)}
          onDeleted={handleDeleted}
        />
      )}
    </AdminLayout>
  );
}
