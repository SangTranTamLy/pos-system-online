import { useEffect, useState } from "react";
import { getAuditLogs } from "../../api/audit-log.api";
import { FilterBar } from "../../components/common/FilterBar";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { fetchShifts, type Shift } from "../../api/shifts.api";
import type { AuditLog } from "../../types/audit-log";
import { translateRole } from "../../utils/role";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";
import Pagination from "../../components/common/Pagination";

type ActionMeta = {
  label: string;
  tone: string;
};

const ACTION_META: Record<string, ActionMeta> = {
  HUY_MON: { label: "Hủy món", tone: "bg-red-50 text-red-600 border-red-100" },
  HUY_HOA_DON: { label: "Hủy hóa đơn", tone: "bg-red-50 text-red-600 border-red-100" },
  HOAN_TIEN: { label: "Hoàn tiền", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_GIA: { label: "Sửa giá món", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_SAN_PHAM: { label: "Sản phẩm", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_DANH_MUC: { label: "Danh mục", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_KHO: { label: "Sửa kho", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_NGUYEN_LIEU: { label: "Nguyên liệu", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_NHA_CUNG_CAP: { label: "Nhà cung cấp", tone: "bg-red-50 text-red-600 border-red-100" },
  HUY_CA: { label: "Hủy ca", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_CAU_HINH: { label: "Cấu hình", tone: "bg-red-50 text-red-600 border-red-100" },
  SUA_NHAN_VIEN: { label: "Nhân viên", tone: "bg-purple-50 text-purple-600 border-purple-100" },
  SUA_KHACH_HANG: { label: "Khách hàng", tone: "bg-purple-50 text-purple-600 border-purple-100" },
  SUA_KHUYEN_MAI: { label: "Khuyến mãi", tone: "bg-purple-50 text-purple-600 border-purple-100" },
  GIAM_GIA: { label: "Giảm giá", tone: "bg-amber-50 text-amber-600 border-amber-100" },
  MO_KET: { label: "Mở két", tone: "bg-amber-50 text-amber-600 border-amber-100" },
  YEU_CAU_DONG_CA: { label: "Yêu cầu đóng ca", tone: "bg-amber-50 text-amber-600 border-amber-100" },
  BAN_HANG: { label: "Bán hàng", tone: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  MO_CA: { label: "Mở ca", tone: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  XAC_NHAN_DONG_CA: { label: "Đóng ca", tone: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  DANG_NHAP: { label: "Đăng nhập", tone: "bg-blue-50 text-blue-600 border-blue-100" },
  DANG_XUAT: { label: "Đăng xuất", tone: "bg-slate-100 text-slate-600 border-slate-200" },
  IN_LAI_BILL: { label: "In lại bill", tone: "bg-slate-100 text-slate-600 border-slate-200" },
};

const ACTION_OPTIONS = Object.entries(ACTION_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const FIELD_LABELS: Record<string, string> = {
  name: "Tên",
  fullName: "Tên",
  phone: "Số điện thoại",
  address: "Địa chỉ",
  sku: "Mã sản phẩm",
  categoryId: "Danh mục",
  categoryName: "Danh mục",
  description: "Mô tả",
  importPrice: "Giá nhập",
  salePrice: "Giá bán",
  stockQuantity: "Tồn kho",
  minStock: "Tồn kho tối thiểu",
  unit: "Đơn vị",
  imageUrl: "Ảnh",
  isAvailable: "Trạng thái bán",
  isActive: "Trạng thái",
  requiresPreparation: "Chế biến",
  status: "Trạng thái",
  email: "Email",
  code: "Mã",
  discountValue: "Giá trị khuyến mãi",
  startAt: "Ngày bắt đầu",
  endAt: "Ngày kết thúc",
  openingCash: "Tiền đầu ca",
  actualClosingCash: "Tiền mặt chốt ca",
  totalSalesCash: "Doanh thu tiền mặt",
  totalSalesQr: "Doanh thu QR",
  totalSales: "Doanh thu ca",
  variance: "Chênh lệch",
};

function exportToCSV(
  data: Record<string, unknown>[],
  headers: { key: string; label: string }[],
  filename: string
) {
  const csvRows = [
    headers.map((header) => `"${header.label.replace(/"/g, '""')}"`).join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header.key];
          return `"${String(value ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([`\uFEFF${csvRows.join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatKey(key: string) {
  return (
    FIELD_LABELS[key] ||
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase())
  );
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function formatValue(key: string, value: unknown) {
  if (isEmptyValue(value)) return "trống";
  if (key.toLowerCase().includes("image")) return "ảnh";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") {
    if (/price|amount|cash|revenue|discount/i.test(key)) {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString("vi-VN");
  }
  if (typeof value === "object") return "dữ liệu";
  return String(value);
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function renderValueChanges(oldValues: unknown, newValues: unknown, actionType?: string) {
  if (
    !oldValues ||
    !newValues ||
    typeof oldValues !== "object" ||
    typeof newValues !== "object" ||
    Array.isArray(oldValues) ||
    Array.isArray(newValues)
  ) {
    if (!oldValues && !newValues) return null;
    return (
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs font-semibold text-slate-600">
        Nội dung đã được cập nhật.
      </div>
    );
  }

  const oldObj = oldValues as Record<string, unknown>;
  const newObj = newValues as Record<string, unknown>;
  const ignoredKeys = new Set([
    "updated_at",
    "updatedAt",
    "created_at",
    "createdAt",
    "timestamp",
    "password",
    "password_hash",
    "approvedBy",
    "approvedByName",
    "openedBy",
    "openedByName",
    "closedBy",
    "closedByName",
    "actualStartTime",
    "actualEndTime",
    "expectedStartTime",
    "expectedEndTime",
    "createdAt",
    "updatedAt",
  ]);

  if (actionType === "XAC_NHAN_DONG_CA") {
    const variance = Number(newObj.variance || 0);
    const varianceLabel =
      variance === 0
        ? "Không lệch"
        : `${variance > 0 ? "Thừa" : "Thiếu"} ${formatCurrency(Math.abs(variance))}`;

    return (
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs font-semibold text-slate-600">
        <div>Ca làm đã được đóng thành công.</div>
        <div>Doanh thu ca: {formatCurrency(newObj.totalSales)}.</div>
        <div>Tiền mặt chốt ca: {formatCurrency(newObj.actualClosingCash)}.</div>
        <div>Chênh lệch: {varianceLabel}.</div>
      </div>
    );
  }

  const changes = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]))
    .filter((key) => !ignoredKeys.has(key))
    .filter((key) => JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key]));

  if (changes.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs font-semibold text-slate-600">
      {changes.map((key) => {
        const oldValue = oldObj[key];
        const newValue = newObj[key];

        if (key.toLowerCase().includes("image")) {
          const message = isEmptyValue(oldValue)
            ? "Ảnh đã được thêm."
            : isEmptyValue(newValue)
              ? "Ảnh đã được xóa."
              : "Ảnh đã được cập nhật.";
          return <div key={key}>{message}</div>;
        }

        return (
          <div key={key} className="leading-relaxed">
            <span className="font-bold text-slate-700">{formatKey(key)}: </span>
            <span className="text-red-500 line-through">{formatValue(key, oldValue)}</span>
            <span className="mx-1 text-slate-400">→</span>
            <span className="font-bold text-emerald-600">{formatValue(key, newValue)}</span>
          </div>
        );
      })}
    </div>
  );
}

function getActionBadge(actionType: string) {
  const meta = ACTION_META[actionType] || {
    label: actionType,
    tone: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <span className={`rounded-xl border px-3 py-1.5 text-xs font-black uppercase ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

export default function AuditLogsPage() {
  const { notify } = useAppNotifications();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("");
  const [shiftId, setShiftId] = useState("");

  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const data = await fetchShifts();
        setShifts(data);
      } catch (err) {
        console.error("Lỗi lấy danh sách ca làm việc", err);
      }
    });
  }, []);

  const loadLogs = async (
    currentPage = page,
    currentActionType = actionType,
    currentShiftId = shiftId
  ) => {
    setLoading(true);


    try {
      const data = await getAuditLogs({
        page: currentPage,
        limit: 15,
        search: search.trim() || undefined,
        actionType: currentActionType || undefined,
        shiftId: currentShiftId || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Không thể tải nhật ký hệ thống.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadLogs(1, "", ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    void loadLogs(1, actionType, shiftId);
  };

  const handleClearFilters = () => {
    setSearch("");
    setActionType("");
    setShiftId("");
    setPage(1);
    void loadLogs(1, "", "");
  };

  const handleExportCsv = () => {
    const formattedData = logs.map((log) => ({
      timestamp: formatDateTime(log.timestamp),
      employee: `${log.userName || "Hệ thống"} (${translateRole(log.role)})`,
      action: ACTION_META[log.actionType]?.label || log.actionType,
      target: log.targetObject || "",
      description: log.description || "",
    }));

    exportToCSV(
      formattedData,
      [
        { key: "timestamp", label: "Thời gian" },
        { key: "employee", label: "Nhân viên" },
        { key: "action", label: "Hành động" },
        { key: "target", label: "Đối tượng / Đơn hàng" },
        { key: "description", label: "Nội dung chi tiết" },
      ],
      "nhat_ky_he_thong.csv"
    );
  };

  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <AdminLayout
      title="Nhật ký hệ thống"
      subtitle="Theo dõi hoạt động đăng nhập, bán hàng, cập nhật dữ liệu và các thao tác quản trị."
    >
      <div className="min-h-full w-full space-y-6 font-['Inter',sans-serif]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <FilterBar
            search={search}
            onSearchChange={(value) => setSearch(value)}
            searchPlaceholder="Tìm mã đơn, tên món, nhân viên..."
            onClear={handleClearFilters}
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3 lg:flex-row lg:items-center"
            afterClear={
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || logs.length === 0}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="file_download" className="text-base" />
                Xuất báo cáo CSV
              </button>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={shiftId}
                onChange={(event) => {
                  const value = event.target.value;
                  setShiftId(value);
                  setPage(1);
                  void loadLogs(1, actionType, value);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none focus:border-[#f97316]"
              >
                <option value="">Tất cả ca làm</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.userName ? `${shift.userName} - ` : ""}
                    Ca {new Date(shift.expectedStartTime).toLocaleDateString("vi-VN")} (
                    {new Date(shift.expectedStartTime).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    )
                  </option>
                ))}
              </select>

              <select
                value={actionType}
                onChange={(event) => {
                  const value = event.target.value;
                  setActionType(value);
                  setPage(1);
                  void loadLogs(1, value, shiftId);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none focus:border-[#f97316]"
              >
                <option value="">Tất cả hành động</option>
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </FilterBar>
        </section>

        {loading ? (
          <div className="flex h-80 items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <div className="flex flex-col items-center gap-2">
              <Icon name="autorenew" className="animate-spin text-3xl text-[#f97316]" />
              <p className="text-xs font-bold text-slate-400">Đang truy xuất nhật ký...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Thời gian</th>
                    <th className="px-6 py-4">Nhân viên</th>
                    <th className="px-6 py-4">Hành động</th>
                    <th className="px-6 py-4">Đối tượng / Đơn hàng</th>
                    <th className="px-6 py-4">Nội dung chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <tr key={log.id} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-normal text-slate-400">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 text-[#0b1c30]">
                          {log.userName || "Hệ thống"}{" "}
                          <span className="font-semibold text-slate-400">
                            ({translateRole(log.role)})
                          </span>
                        </td>
                        <td className="px-6 py-4">{getActionBadge(log.actionType)}</td>
                        <td className="px-6 py-4 font-extrabold text-[#f97316]">
                          {log.targetObject || "-"}
                        </td>
                        <td className="max-w-md whitespace-pre-line px-6 py-4 font-medium leading-relaxed text-slate-500">
                          <div>{log.description || "Không có mô tả."}</div>
                          {renderValueChanges(log.oldValues, log.newValues, log.actionType)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center font-bold text-slate-400">
                        Không có hoạt động nào phù hợp với điều kiện tìm kiếm.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={15}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  void loadLogs(newPage, actionType, shiftId);
                }}
                itemName="nhật ký"
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
