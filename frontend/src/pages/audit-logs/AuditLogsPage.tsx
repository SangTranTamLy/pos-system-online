import { useEffect, useState } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { getAuditLogs } from "../../api/audit-log.api";
import { translateRole } from "../../utils/role";

import { fetchShifts, type Shift } from "../../api/shifts.api";
import type { AuditLog } from "../../types/audit-log";
import { FilterBar } from "../../components/common/FilterBar";

function exportToCSV(data: Record<string, unknown>[], headers: { key: string; label: string }[], filename: string) {
  const csvRows = [];
  csvRows.push(headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(","));
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h.key];
      const escaped = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderValueChanges(oldValues: unknown, newValues: unknown) {
  if (!oldValues && !newValues) return null;

  const formatVal = (val: unknown) => {
    if (val === null || val === undefined) return "null";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  if (
    oldValues &&
    newValues &&
    typeof oldValues === "object" &&
    typeof newValues === "object" &&
    !Array.isArray(oldValues) &&
    !Array.isArray(newValues)
  ) {
    const oldObj = oldValues as Record<string, unknown>;
    const newObj = newValues as Record<string, unknown>;
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const changes: { key: string; oldVal: unknown; newVal: unknown }[] = [];
    const ignoredKeys = ["updated_at", "updatedAt", "created_at", "createdAt", "timestamp", "password", "password_hash"];

    for (const key of allKeys) {
      if (ignoredKeys.includes(key)) continue;
      const oldVal = oldObj[key];
      const newVal = newObj[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ key, oldVal, newVal });
      }
    }

    if (changes.length > 0) {
      return (
        <div className="mt-2 text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-100 max-h-40 overflow-y-auto">
          {changes.map(({ key, oldVal, newVal }) => (
            <div key={key} className="mb-1 last:mb-0 leading-normal">
              <span className="font-bold text-slate-700">{key}: </span>
              {oldVal !== undefined && (
                <span className="text-red-500 line-through mr-2">{formatVal(oldVal)}</span>
              )}
              {newVal !== undefined && (
                <span className="text-emerald-600 font-bold">➔ {formatVal(newVal)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="mt-2 text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-100 max-h-40 overflow-y-auto">
      {!!oldValues && (
        <div className="text-red-500 mb-1 leading-normal">
          <span className="font-bold">- Cũ: </span>
          {typeof oldValues === "object" ? JSON.stringify(oldValues, null, 2) : String(oldValues)}
        </div>
      )}
      {!!newValues && (
        <div className="text-emerald-600 leading-normal">
          <span className="font-bold">+ Mới: </span>
          {typeof newValues === "object" ? JSON.stringify(newValues, null, 2) : String(newValues)}
        </div>
      )}
    </div>
  );
}

function getActionBadge(actionType: string) {
  switch (actionType) {
    // Rủi ro cao / Sửa đổi lớn (Đỏ)
    case "HUY_MON":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ HỦY MÓN ]</span>;
    case "HUY_HOA_DON":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ HỦY HÓA ĐƠN ]</span>;
    case "HOAN_TIEN":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ HOÀN TIỀN ]</span>;
    case "SUA_GIA":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ SỬA GIÁ MÓN ]</span>;
    case "SUA_SAN_PHAM":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ SẢN PHẨM ]</span>;
    case "SUA_DANH_MUC":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ DANH MỤC ]</span>;
    case "SUA_KHO":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ SỬA KHO ]</span>;
    case "SUA_NGUYEN_LIEU":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ NGUYÊN LIỆU ]</span>;
    case "SUA_NHA_CUNG_CAP":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ NHÀ CUNG CẤP ]</span>;
    case "HUY_CA":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ HỦY CA ]</span>;
    case "SUA_CAU_HINH":
      return <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 border border-red-150 uppercase">[ CẤU HÌNH ]</span>;

    // Cần lưu ý / Quản lý khách hàng, khuyến mãi (Tím / Vàng)
    case "SUA_NHAN_VIEN":
      return <span className="rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-black text-purple-600 border border-purple-150 uppercase">[ NHÂN VIÊN ]</span>;
    case "SUA_KHACH_HANG":
      return <span className="rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-black text-purple-600 border border-purple-150 uppercase">[ KHÁCH HÀNG ]</span>;
    case "SUA_KHUYEN_MAI":
      return <span className="rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-black text-purple-600 border border-purple-150 uppercase">[ KHUYẾN MÃI ]</span>;
    
    case "GIAM_GIA":
      return <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600 border border-amber-150 uppercase">[ GIẢM GIÁ ]</span>;
    case "MO_KET":
      return <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600 border border-amber-150 uppercase">[ MỞ KÉT ]</span>;
    case "YEU_CAU_DONG_CA":
      return <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600 border border-amber-150 uppercase">[ YC ĐÓNG CA ]</span>;
    
    // Bình thường / Giao dịch (Xanh dương / Xám / Xanh lá)
    case "BAN_HANG":
      return <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-600 border border-emerald-150 uppercase">[ BÁN HÀNG ]</span>;
    case "MO_CA":
      return <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-600 border border-emerald-150 uppercase">[ MỞ CA ]</span>;
    case "XAC_NHAN_DONG_CA":
      return <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-600 border border-emerald-150 uppercase">[ ĐÓNG CA ]</span>;
    
    case "DANG_NHAP":
      return <span className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-600 border border-blue-150 uppercase">[ ĐĂNG NHẬP ]</span>;
    
    case "DANG_XUAT":
      return <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500 border border-slate-150 uppercase">[ ĐĂNG XUẤT ]</span>;
    case "IN_LAI_BILL":
      return <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500 border border-slate-150 uppercase">[ IN LẠI BILL ]</span>;
    
    default:
      return <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600 border border-slate-150 uppercase">[ {actionType} ]</span>;
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("");
  const [shiftId, setShiftId] = useState("");

  // Load shifts list to populate dropdown
  useEffect(() => {
    fetchShifts()
      .then(data => setShifts(data))
      .catch(err => console.error("Lỗi lấy danh sách ca làm việc", err));
  }, []);

  const loadLogs = async (currentPage = page, currentActionType = actionType, currentShiftId = shiftId) => {
    await Promise.resolve();
    setLoading(true);
    setError("");
    try {
      const data = await getAuditLogs({
        page: currentPage,
        limit: 15,
        search: search.trim() || undefined,
        actionType: currentActionType || undefined,
        shiftId: currentShiftId || undefined
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải nhật ký hoạt động");
    } finally {
      setLoading(false);
    }
  };

  // Load logs on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs(1, "", "");
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleExportExcel = () => {
    const formattedData = logs.map(log => ({
      timestamp: new Date(log.timestamp).toLocaleString("vi-VN"),
      employee: `${log.userName} (${log.role})`,
      action: log.actionType,
      target: log.targetObject || "",
      description: log.description || ""
    }));

    exportToCSV(
      formattedData,
      [
        { key: "timestamp", label: "Thời gian" },
        { key: "employee", label: "Nhân viên" },
        { key: "action", label: "Hành động" },
        { key: "target", label: "Đối tượng / Đơn hàng" },
        { key: "description", label: "Nội dung chi tiết" }
      ],
      `nhat_ky_hoat_dong_pos.csv`
    );
  };

  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <AdminLayout
      headerContent={
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
          <span>QUẢN LÝ TÀI CHÍNH</span>
          <Icon name="chevron_right" className="text-[12px]" />
          <span className="text-slate-600">Nhật ký hoạt động (Audit Log)</span>
        </div>
      }
    >
      {/* Title & Export bar */}
      <section className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-black tracking-tight text-[#0b1c30]">
          NHẬT KÝ HOẠT ĐỘNG TẠI QUẦY
        </h1>
        <button
          onClick={handleExportExcel}
          disabled={loading || logs.length === 0}
          className="flex h-9.5 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
        >
          <Icon name="file_download" className="text-base" />
          Xuất báo cáo Excel
        </button>
      </section>

      {/* Filter box */}
      <section className="mb-6 rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm">
        <FilterBar
          search={search}
          onSearchChange={val => setSearch(val)}
          searchPlaceholder="Tìm mã đơn, tên món..."
          onClear={handleClearFilters}
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* Shifts list filter */}
            <select
              value={shiftId}
              onChange={e => {
                const val = e.target.value;
                setShiftId(val);
                setPage(1);
                void loadLogs(1, actionType, val);
              }}
              className="h-11.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-[#f97316]"
            >
              <option value="">-- Tất cả các ca --</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>
                  {shift.userName ? `${shift.userName} - ` : ""}Ca {new Date(shift.expectedStartTime).toLocaleDateString('vi-VN')} ({new Date(shift.expectedStartTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                </option>
              ))}
            </select>

            {/* Action Type filter */}
            <select
              value={actionType}
              onChange={e => {
                const val = e.target.value;
                setActionType(val);
                setPage(1);
                void loadLogs(1, val, shiftId);
              }}
              className="h-11.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-[#f97316]"
            >
              <option value="">-- Chọn loại hành động --</option>
              <option value="BAN_HANG">BÁN HÀNG (Xanh lá)</option>
              <option value="GIAM_GIA">GIẢM GIÁ (Vàng)</option>
              <option value="HUY_MON">HỦY MÓN (Đỏ)</option>
              <option value="HUY_HOA_DON">HỦY HÓA ĐƠN (Đỏ)</option>
              <option value="HOAN_TIEN">HOÀN TIỀN (Đỏ)</option>
              <option value="SUA_GIA">SỬA GIÁ MÓN (Đỏ)</option>
              <option value="SUA_SAN_PHAM">SỬA SẢN PHẨM (Đỏ)</option>
              <option value="SUA_DANH_MUC">SỬA DANH MỤC (Đỏ)</option>
              <option value="SUA_KHO">SỬA KHO (Đỏ)</option>
              <option value="SUA_NGUYEN_LIEU">SỬA NGUYÊN LIỆU (Đỏ)</option>
              <option value="SUA_NHA_CUNG_CAP">SỬA NHÀ CUNG CẤP (Đỏ)</option>
              <option value="SUA_KHACH_HANG">SỬA KHÁCH HÀNG (Tím)</option>
              <option value="SUA_KHUYEN_MAI">SỬA KHUYẾN MÃI (Tím)</option>
              <option value="SUA_NHAN_VIEN">SỬA NHÂN VIÊN (Tím)</option>
              <option value="MO_CA">MỞ CA (Xanh lá)</option>
              <option value="YEU_CAU_DONG_CA">YC ĐÓNG CA (Vàng)</option>
              <option value="XAC_NHAN_DONG_CA">ĐÓNG CA (Xanh lá)</option>
              <option value="HUY_CA">HỦY CA (Đỏ)</option>
              <option value="MO_KET">MỞ KÉT (Vàng)</option>
              <option value="DANG_NHAP">ĐĂNG NHẬP (Xanh)</option>
              <option value="DANG_XUAT">ĐĂNG XUẤT (Xám)</option>
              <option value="IN_LAI_BILL">IN LẠI BILL (Xám)</option>
              <option value="SUA_CAU_HINH">SỬA CẤU HÌNH (Đỏ)</option>
            </select>
          </div>
        </FilterBar>
      </section>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* Main Table logs */}
      {loading ? (
        <div className="flex h-80 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-2">
            <Icon name="autorenew" className="animate-spin text-3xl text-[#f97316]" />
            <p className="text-xs font-bold text-slate-400">Đang truy xuất nhật ký...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-wider">
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
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-normal">
                        {new Date(log.timestamp).toLocaleString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })}
                      </td>
                      <td className="px-6 py-4 text-[#0b1c30]">
                        {log.userName} <span className="font-semibold text-slate-400">({translateRole(log.role)})</span>
                      </td>
                      <td className="px-6 py-4">{getActionBadge(log.actionType)}</td>
                      <td className="px-6 py-4 text-[#f97316] font-extrabold">{log.targetObject}</td>
                      <td className="px-6 py-4 text-slate-500 font-medium whitespace-pre-line leading-relaxed max-w-md">
                        <div>{log.description}</div>
                        {renderValueChanges(log.oldValues, log.newValues)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                      Không có hoạt động nào được ghi lại trong điều kiện tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
            <span className="text-xs text-slate-500 font-bold">
              Hiển thị {logs.length} / {total} nhật ký
            </span>
            <div className="flex items-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  void loadLogs(newPage, actionType, shiftId);
                }}
                className="flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"
              >
                <Icon name="chevron_left" className="text-lg" />
                Trước
              </button>
              <span className="text-xs font-bold text-slate-600">
                Trang {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  void loadLogs(newPage, actionType, shiftId);
                }}
                className="flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"
              >
                Sau
                <Icon name="chevron_right" className="text-lg" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
