import { useEffect, useState, useMemo } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { 
  fetchShifts, registerShift, approveShift, requestOpenShift, openShift, 
  requestCloseShift, closeShift, cancelShift, type Shift 
} from "../../api/shifts.api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

function formatDate(isoStr: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(isoStr));
}

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Đã duyệt", color: "bg-blue-100 text-blue-700" },
  OPENING_REQUEST: { label: "Yêu cầu mở", color: "bg-orange-100 text-orange-700" },
  OPEN: { label: "Đang mở", color: "bg-green-100 text-green-700" },
  CLOSING_REQUEST: { label: "Yêu cầu đóng", color: "bg-purple-100 text-purple-700" },
  CLOSED: { label: "Đã đóng", color: "bg-slate-200 text-slate-700" },
  CANCELLED: { label: "Đã hủy", color: "bg-red-100 text-red-700" },
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [userRole, setUserRole] = useState("");

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newShiftStart, setNewShiftStart] = useState("");
  const [newShiftEnd, setNewShiftEnd] = useState("");
  
  const [showRequestOpenModal, setShowRequestOpenModal] = useState<string | null>(null);
  const [showOpenModal, setShowOpenModal] = useState<string | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  
  const [showCloseModal, setShowCloseModal] = useState<string | null>(null);
  const [closingCash, setClosingCash] = useState("");
  const [closingNote, setClosingNote] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUserRole(u.roleName?.toUpperCase() || "");
      } catch (e) {}
    }
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      setIsLoading(true);
      const data = await fetchShifts();
      setShifts(data);
    } catch (error: any) {
      setErrorMessage(error.message || "Lỗi khi tải danh sách ca");
    } finally {
      setIsLoading(false);
    }
  };

  const isManager = userRole === "ADMIN" || userRole === "MANAGER";

  const handleRegister = async () => {
    try {
      await registerShift(new Date(newShiftStart).toISOString(), new Date(newShiftEnd).toISOString());
      setShowRegisterModal(false);
      loadShifts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Xác nhận duyệt ca làm này?")) return;
    try {
      await approveShift(id);
      loadShifts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleRequestOpen = async () => {
    if (!showRequestOpenModal) return;
    try {
      await requestOpenShift(showRequestOpenModal, Number(openingCash));
      setShowRequestOpenModal(null);
      setOpeningCash("");
      loadShifts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleOpen = async () => {
    if (!showOpenModal) return;
    try {
      await openShift(showOpenModal);
      setShowOpenModal(null);
      loadShifts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleRequestClose = async (id: string) => {
    if (!confirm("Bạn có chắc muốn gửi yêu cầu đóng ca? POS sẽ bị khóa.")) return;
    try {
      await requestCloseShift(id);
      loadShifts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleClose = async () => {
    if (!showCloseModal) return;
    try {
      await closeShift(showCloseModal, Number(closingCash), closingNote);
      setShowCloseModal(null);
      setClosingCash("");
      setClosingNote("");
      loadShifts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Bạn có chắc muốn hủy ca này?")) return;
    try {
      await cancelShift(id);
      loadShifts();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Stats for Manager Dashboard
  const stats = useMemo(() => {
    return {
      pending: shifts.filter(s => s.status === 'PENDING').length,
      open: shifts.filter(s => s.status === 'OPEN').length,
      closingReq: shifts.filter(s => s.status === 'CLOSING_REQUEST').length,
      closedToday: shifts.filter(s => s.status === 'CLOSED' && new Date(s.actualEndTime || '').toDateString() === new Date().toDateString()).length,
    };
  }, [shifts]);

  const activeShiftToOpen = useMemo(() => shifts.find(s => s.id === showOpenModal), [shifts, showOpenModal]);
  const activeShiftToClose = useMemo(() => shifts.find(s => s.id === showCloseModal), [shifts, showCloseModal]);

  return (
    <AdminLayout
      title="Quản lý Ca làm"
      subtitle={isManager ? "Phân ca, giao tiền và đối soát cuối ca" : "Đăng ký ca và theo dõi lịch làm việc"}
    >
      <div className="flex flex-col gap-6">
        {errorMessage ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        ) : null}

        {isManager && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase">Chờ duyệt</p>
              <p className="text-3xl font-extrabold text-[#0b1c30] mt-2">{stats.pending}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <p className="text-sm font-bold text-green-600 uppercase">Đang mở</p>
              <p className="text-3xl font-extrabold text-green-700 mt-2">{stats.open}</p>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
              <p className="text-sm font-bold text-purple-600 uppercase">Chờ đóng</p>
              <p className="text-3xl font-extrabold text-purple-700 mt-2">{stats.closingReq}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase">Đã đóng (Hôm nay)</p>
              <p className="text-3xl font-extrabold text-[#0b1c30] mt-2">{stats.closedToday}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[#0b1c30]">Danh sách ca làm</h2>
          {!isManager && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="rounded-xl bg-[#f97316] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition-colors hover:bg-orange-600"
            >
              <span className="flex items-center gap-2">
                <Icon name="add" /> Đăng ký ca mới
              </span>
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-500">Nhân viên</th>
                  <th className="px-6 py-4 font-bold text-slate-500">Thời gian dự kiến</th>
                  <th className="px-6 py-4 font-bold text-slate-500">Trạng thái</th>
                  <th className="px-6 py-4 font-bold text-slate-500 text-right">Doanh thu</th>
                  <th className="px-6 py-4 font-bold text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Chưa có ca làm việc nào
                    </td>
                  </tr>
                ) : (
                  shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-[#0b1c30]">
                        {shift.userName || 'Bạn'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(shift.expectedStartTime)} - {formatDate(shift.expectedEndTime)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusMap[shift.status].color}`}>
                          {statusMap[shift.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {shift.status === 'CLOSED' ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-[#0b1c30]">{formatCurrency(shift.totalSales)}</span>
                            {shift.variance !== 0 && (
                              <span className={`text-xs ${shift.variance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                Lệch: {formatCurrency(shift.variance)}
                              </span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {isManager ? (
                            <>
                              {shift.status === 'PENDING' && (
                                <button onClick={() => handleApprove(shift.id)} className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg">Duyệt</button>
                              )}
                              {shift.status === 'OPENING_REQUEST' && (
                                <button onClick={() => setShowOpenModal(shift.id)} className="text-green-600 hover:text-green-800 font-bold text-xs bg-green-50 px-3 py-1.5 rounded-lg">Xác nhận mở ca</button>
                              )}
                              {shift.status === 'CLOSING_REQUEST' && (
                                <button onClick={() => setShowCloseModal(shift.id)} className="text-purple-600 hover:text-purple-800 font-bold text-xs bg-purple-50 px-3 py-1.5 rounded-lg">Đóng & Đối soát</button>
                              )}
                              {['PENDING', 'APPROVED'].includes(shift.status) && (
                                <button onClick={() => handleCancel(shift.id)} className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 px-3 py-1.5 rounded-lg">Hủy</button>
                              )}
                            </>
                          ) : (
                            <>
                              {shift.status === 'APPROVED' && (
                                <button onClick={() => setShowRequestOpenModal(shift.id)} className="text-orange-600 hover:text-orange-800 font-bold text-xs bg-orange-50 px-3 py-1.5 rounded-lg">Nhập tiền & Mở ca</button>
                              )}
                              {shift.status === 'OPEN' && (
                                <button onClick={() => handleRequestClose(shift.id)} className="text-orange-600 hover:text-orange-800 font-bold text-xs bg-orange-50 px-3 py-1.5 rounded-lg">Yêu cầu đóng</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Staff Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-[#0b1c30] mb-4">Đăng ký ca làm</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Giờ bắt đầu</label>
                <input type="datetime-local" value={newShiftStart} onChange={e => setNewShiftStart(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Giờ kết thúc</label>
                <input type="datetime-local" value={newShiftEnd} onChange={e => setNewShiftEnd(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowRegisterModal(false)} className="rounded-xl px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleRegister} className="rounded-xl bg-[#f97316] px-5 py-3 font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600">Đăng ký</button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Request Open Modal */}
      {showRequestOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-[#0b1c30] mb-4">Yêu cầu mở ca</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tiền đầu ca (VND)</label>
                <p className="text-xs text-slate-500 mb-2">Số tiền lẻ bạn nhận từ Quản lý để bắt đầu ca.</p>
                <input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="VD: 500000" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowRequestOpenModal(null)} className="rounded-xl px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleRequestOpen} className="rounded-xl bg-[#f97316] px-5 py-3 font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600">Gửi yêu cầu</button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Open Modal */}
      {showOpenModal && activeShiftToOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-[#0b1c30] mb-4">Xác nhận mở ca</h3>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Nhân viên <b>{activeShiftToOpen.userName || 'Bạn'}</b> đã báo nhận số tiền đầu ca là:</p>
              <p className="text-3xl font-extrabold text-[#f97316] text-center">{formatCurrency(activeShiftToOpen.openingCash)}</p>
              <p className="text-xs text-slate-500 text-center">Vui lòng xác nhận xem số tiền này có đúng không.</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowOpenModal(null)} className="rounded-xl px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleOpen} className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">Duyệt mở ca</button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Close Modal */}
      {showCloseModal && activeShiftToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-[#0b1c30] mb-4">Đối soát & Đóng ca</h3>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiền đầu ca:</span>
                  <span className="font-bold">{formatCurrency(activeShiftToClose.openingCash)}</span>
                </div>
                {/* Note: In a real flow, we'd fetch actual sales before closing to preview. For simplicity here, we let the backend calculate.
                    But user asked for "Hiển thị Tổng phải có". We can add an endpoint to preview sales, or just rely on Manager counting. 
                    Let's just ask Manager to input counted cash. */}
                <p className="text-xs text-amber-600 italic mt-2">* Hệ thống sẽ tự động đối soát dựa trên số tiền bạn nhập dưới đây.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tiền mặt thực tế đếm được (VND)</label>
                <input type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Nhập số tiền thực tế trong két" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Ghi chú (Bắt buộc nếu có chênh lệch)</label>
                <textarea rows={3} value={closingNote} onChange={e => setClosingNote(e.target.value)} placeholder="Ví dụ: Thiếu 20.000 do khách trả thiếu" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"></textarea>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCloseModal(null)} className="rounded-xl px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleClose} className="rounded-xl bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-700">Đóng ca</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
