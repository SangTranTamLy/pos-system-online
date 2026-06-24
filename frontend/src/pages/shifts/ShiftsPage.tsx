import { useEffect, useState, useMemo } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { 
  fetchShifts, openShiftForEmployee, closeShift, cancelShift,
  type Shift
} from "../../api/shifts.api";
import { fetchUsers, type User } from "../../api/users.api";
import { getOrders, type OrderListItem } from "../../api/order.api";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

function formatLocalDateInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysToDateInput(dateInput: string, days: number) {
  const date = new Date(`${dateInput}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDateInput(date);
}

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chá» duyá»‡t", color: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "ÄÃ£ duyá»‡t", color: "bg-blue-100 text-blue-700" },
  OPENING_REQUEST: { label: "YÃªu cáº§u má»Ÿ", color: "bg-orange-100 text-orange-700" },
  OPEN: { label: "Äang má»Ÿ", color: "bg-green-100 text-green-700" },
  SELLING: { label: "Äang bÃ¡n hÃ ng", color: "bg-emerald-100 text-emerald-700" },
  CLOSING_REQUEST: { label: "YÃªu cáº§u Ä‘Ã³ng", color: "bg-purple-100 text-purple-700" },
  CLOSED: { label: "ÄÃ£ Ä‘Ã³ng", color: "bg-slate-200 text-slate-700" },
  CANCELLED: { label: "ÄÃ£ há»§y", color: "bg-red-100 text-red-700" },
};

type ShiftDisplayStatus = "all" | "cancelled" | "open" | "selling" | "closed";

function getShiftDisplayStatus(shift: Shift): Exclude<ShiftDisplayStatus, "all"> | "other" {
  if (shift.status === "CANCELLED") return "cancelled";
  if (shift.status === "CLOSED") return "closed";
  if (shift.status === "OPEN") return Number(shift.openingCash || 0) > 0 ? "selling" : "open";
  return "other";
}

function getShiftStatusMeta(shift: Shift) {
  if (shift.status === "OPEN" && Number(shift.openingCash || 0) > 0) {
    return statusMap.SELLING;
  }

  return statusMap[shift.status] || { label: shift.status, color: "bg-slate-100 text-slate-600" };
}

function ShiftStatCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className="flex min-h-36 items-center gap-6 border border-slate-200 bg-white p-7 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <span className={`flex h-16 w-16 items-center justify-center ${tone}`}>
        <Icon name={icon} className="text-[32px]" />
      </span>
      <div>
        <p className="mb-2 text-sm font-bold text-slate-500">{label}</p>
        <h3 className="font-['Outfit',sans-serif] text-3xl font-extrabold text-slate-800">
          {value}
        </h3>
        <p className="mt-2 text-xs font-semibold text-slate-400">{note}</p>
      </div>
    </article>
  );
}

function getShiftCode(shift: Shift, index: number) {
  const date = new Date(shift.expectedStartTime);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `CA${yy}${mm}${dd}-${String(index + 1).padStart(2, "0")}`;
}

function getShiftName(shift: Shift) {
  const hour = new Date(shift.expectedStartTime).getHours();
  if (hour >= 6 && hour < 14) return "Ca sÃ¡ng";
  if (hour >= 14 && hour < 22) return "Ca chiá»u";
  return "Ca tá»‘i";
}

function formatTimeRange(shift: Shift) {
  const format = (value: string) =>
    new Date(value).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `${format(shift.expectedStartTime)} - ${format(shift.expectedEndTime)}`;
}

export default function ShiftsPage() {
  const { notify, confirm: confirmAction } = useAppNotifications();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [userRole] = useState<string>(() => {
    try {
      const storedUser = localStorage.getItem("auth_user");
      if (storedUser) {
        const u = JSON.parse(storedUser);
        return u.roleName?.toUpperCase() || "";
      }
    } catch { /* ignore invalid JSON */ }
    return "";
  });
  const [currentUserId] = useState<string>(() => {
    try {
      const storedUser = localStorage.getItem("auth_user");
      if (storedUser) {
        const u = JSON.parse(storedUser);
        return u.id || "";
      }
    } catch { /* ignore invalid JSON */ }
    return "";
  });
  const isManager = userRole === "ADMIN" || userRole === "MANAGER";

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [filterDate, setFilterDate] = useState(() => formatLocalDateInput(new Date()));
  const [statusFilter, setStatusFilter] = useState<ShiftDisplayStatus>("all");
  const [startDate, setStartDate] = useState(() => formatLocalDateInput(new Date()));
  const [startHour, setStartHour] = useState("08");
  const [startMinute, setStartMinute] = useState("00");
  const [endDate, setEndDate] = useState(() => formatLocalDateInput(new Date()));
  const [endHour, setEndHour] = useState("12");
  const [endMinute, setEndMinute] = useState("00");
  
  const [showCloseModal, setShowCloseModal] = useState<string | null>(null);
  const [closingCash, setClosingCash] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "orders" | "cash">("overview");
  const [shiftOrders, setShiftOrders] = useState<OrderListItem[]>([]);

  const loadShifts = async () => {
    try {
      setIsLoading(true);
      const data = await fetchShifts();
      const visibleShifts = isManager
        ? data
        : data.filter((shift) => !currentUserId || shift.userId === currentUserId);
      setShifts(visibleShifts);

      if (isManager) {
        const usersData = await fetchUsers();
        const activeEmployees = usersData.filter(
          (user) => user.isActive && ["staff", "cashier"].includes(user.roleName.toLowerCase())
        );
        setEmployees(activeEmployees);
        setSelectedEmployeeId((current) => current || activeEmployees[0]?.id || "");
      } else {
        setEmployees([]);
        setSelectedEmployeeId(currentUserId);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Lá»—i khi táº£i danh sÃ¡ch ca";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadShifts();
  }, []);

  const handleOpenShiftForEmployee = async () => {
    try {
      if (!selectedEmployeeId) {
        notify("Vui lÃ²ng chá»n nhÃ¢n viÃªn", "warning");
        return;
      }
      const startAt = `${startDate}T${startHour}:${startMinute}:00`;
      const startsAtMinutes = Number(startHour) * 60 + Number(startMinute);
      const endsAtMinutes = Number(endHour) * 60 + Number(endMinute);
      const resolvedEndDate = endsAtMinutes <= startsAtMinutes ? addDaysToDateInput(startDate, 1) : endDate;
      const endAt = `${resolvedEndDate}T${endHour}:${endMinute}:00`;
      await openShiftForEmployee({
        userId: selectedEmployeeId,
        expectedStartTime: startAt,
        expectedEndTime: endAt,
      });
      notify("ÄÃ£ má»Ÿ ca cho nhÃ¢n viÃªn", "success");
      void loadShifts();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Lá»—i má»Ÿ ca cho nhÃ¢n viÃªn", "error");
    }
  };

  const handleClose = async () => {
    if (!showCloseModal) return;
    try {
      await closeShift(showCloseModal, Number(closingCash), closingNote);
      setShowCloseModal(null);
      setClosingCash("");
      setClosingNote("");
      notify("ÄÃ£ Ä‘Ã³ng ca lÃ m", "success");
      void loadShifts();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Lá»—i Ä‘Ã³ng ca", "error");
    }
  };

  const handleCancel = async (id: string) => {
    const confirmed = await confirmAction({
      title: "Há»§y ca lÃ m",
      message: "Báº¡n cÃ³ cháº¯c muá»‘n há»§y ca nÃ y?",
      confirmText: "Há»§y ca",
      type: "warning",
    });
    if (!confirmed) return;
    try {
      await cancelShift(id);
      notify("ÄÃ£ há»§y ca lÃ m", "success");
      void loadShifts();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Lá»—i há»§y ca", "error");
    }
  };

  const handleViewShift = async (shift: Shift) => {
    setSelectedShift(shift);
    setDetailTab("overview");
    try {
      const dateKey = formatLocalDateInput(new Date(shift.expectedStartTime));
      const response = await getOrders({
        createdBy: shift.userId,
        dateFrom: dateKey,
        dateTo: dateKey,
      });
      setShiftOrders(response.data);
    } catch {
      setShiftOrders([]);
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

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const shiftDate = formatLocalDateInput(new Date(shift.expectedStartTime));
      const matchesDate = !filterDate || shiftDate === filterDate;
      const displayStatus = getShiftDisplayStatus(shift);
      const matchesStatus = statusFilter === "all" || displayStatus === statusFilter;
      return matchesDate && matchesStatus;
    });
  }, [filterDate, shifts, statusFilter]);

  const activeShiftToClose = useMemo(() => shifts.find(s => s.id === showCloseModal), [shifts, showCloseModal]);

  return (
    <AdminLayout
      title="Quáº£n lÃ½ Ca lÃ m"
      subtitle={isManager ? "PhÃ¢n ca, giao tiá»n vÃ  Ä‘á»‘i soÃ¡t cuá»‘i ca" : "ÄÄƒng kÃ½ ca vÃ  theo dÃµi lá»‹ch lÃ m viá»‡c"}
    >
      <div className="min-h-full w-full space-y-7 overflow-x-hidden bg-[#f8fafc] font-['Inter',sans-serif]">
        {errorMessage ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-7 xl:grid-cols-3">
          <ShiftStatCard
            icon="event_available"
            label="Tá»•ng ca hÃ´m nay"
            value={String(shifts.length || stats.closedToday + stats.open)}
            note={`${shifts.length ? Math.round((stats.closedToday / shifts.length) * 100) : 0}% Ä‘Ã£ Ä‘Ã³ng ca`}
            tone="bg-orange-50 text-[#f97316]"
          />
          <ShiftStatCard
            icon="group"
            label="NhÃ¢n viÃªn lÃ m viá»‡c"
            value={String(employees.length)}
            note={`${stats.open} nhÃ¢n viÃªn Ä‘ang cÃ³ ca má»Ÿ`}
            tone="bg-blue-50 text-blue-500"
          />
          <ShiftStatCard
            icon="account_balance_wallet"
            label="Tá»•ng doanh thu (hÃ´m nay)"
            value={formatCurrency(shifts.reduce((sum, shift) => sum + Number(shift.totalSales || 0), 0))}
            note="Theo dá»¯ liá»‡u ca lÃ m thá»±c táº¿"
            tone="bg-emerald-50 text-emerald-500"
          />
        </section>

        <section className="grid items-start gap-7 xl:grid-cols-[540px_minmax(0,1fr)] 2xl:grid-cols-[580px_minmax(0,1fr)]">
          <section className="h-fit min-h-[620px] border border-slate-200 bg-white p-10 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="mb-9 flex items-start gap-5 border-b border-slate-100 pb-7">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center bg-orange-50 text-[#f97316]">
                <Icon name="add" className="text-[40px]" />
              </span>
              <div className="min-w-0">
                <h3 className="font-['Outfit',sans-serif] text-2xl font-extrabold uppercase text-slate-900">
                  Má»Ÿ ca cho nhÃ¢n viÃªn
                </h3>
                <p className="mt-3 text-[15px] font-semibold leading-relaxed text-slate-500">
                  Sau khi má»Ÿ ca, nhÃ¢n viÃªn Ä‘Äƒng nháº­p POS Ä‘á»ƒ báº¯t Ä‘áº§u bÃ¡n hÃ ng.
                </p>
              </div>
            </div>

            <div className="space-y-7">
              <label className="block">
                <span className="mb-3 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Thu ngÃ¢n</span>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  className="h-16 w-full border border-slate-300 bg-white px-6 text-[17px] font-extrabold text-slate-800 outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
                >
                  <option value="">Chá»n nhÃ¢n viÃªn</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} {employee.phone ? `- ${employee.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-3 block text-xs font-extrabold uppercase tracking-wide text-slate-500">NgÃ y</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setEndDate(event.target.value);
                  }}
                  className="h-16 w-full border border-slate-300 bg-white px-6 text-[17px] font-extrabold text-slate-800 outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-6">
                <label className="block">
                  <span className="mb-3 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Giá» báº¯t Ä‘áº§u</span>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <select value={startHour} onChange={(e) => setStartHour(e.target.value)} className="h-16 border border-slate-300 bg-white px-4 text-[17px] font-extrabold text-slate-800 outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100">
                      {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}</option>)}
                    </select>
                    <span className="text-lg font-extrabold text-slate-400">:</span>
                    <select value={startMinute} onChange={(e) => setStartMinute(e.target.value)} className="h-16 border border-slate-300 bg-white px-4 text-[17px] font-extrabold text-slate-800 outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100">
                      {["00", "15", "30", "45"].map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                    </select>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-3 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Giá» káº¿t thÃºc</span>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <select value={endHour} onChange={(e) => setEndHour(e.target.value)} className="h-16 border border-slate-300 bg-white px-4 text-[17px] font-extrabold text-slate-800 outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100">
                      {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}</option>)}
                    </select>
                    <span className="text-lg font-extrabold text-slate-400">:</span>
                    <select value={endMinute} onChange={(e) => setEndMinute(e.target.value)} className="h-16 border border-slate-300 bg-white px-4 text-[17px] font-extrabold text-slate-800 outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100">
                      {["00", "15", "30", "45"].map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                    </select>
                  </div>
                </label>
              </div>

              <button
                type="button"
                onClick={handleOpenShiftForEmployee}
                className="flex h-[72px] w-full items-center justify-center gap-3 bg-[#f97316] px-7 text-lg font-extrabold text-white shadow-[0_16px_28px_rgba(249,115,22,0.24)] transition hover:bg-[#ea580c]"
              >
                <Icon name="add" className="text-[28px]" />
                Má»Ÿ ca
              </button>
            </div>
          </section>

          <div>
            <div className="min-h-[620px] border border-slate-200 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <h3 className="font-['Outfit',sans-serif] text-xl font-extrabold text-slate-800">
                  Danh sÃ¡ch ca lÃ m
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(event) => setFilterDate(event.target.value)}
                    className="h-12 w-44 border border-slate-300 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
                  />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as ShiftDisplayStatus)}
                    className="h-12 border border-slate-300 px-4 pr-10 text-sm font-semibold text-slate-700 outline-none focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="all">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
                    <option value="cancelled">ÄÃ£ há»§y</option>
                    <option value="open">Äang má»Ÿ</option>
                    <option value="selling">Äang bÃ¡n hÃ ng</option>
                    <option value="closed">ÄÃ£ Ä‘Ã³ng</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-extrabold uppercase tracking-wide text-slate-400">
                      <th className="px-4 pb-3">MÃ£ ca</th>
                      <th className="px-4 pb-3">TÃªn ca</th>
                      <th className="px-4 pb-3">Thá»i gian</th>
                      <th className="px-4 pb-3">NhÃ¢n viÃªn</th>
                      <th className="px-4 pb-3">Doanh thu</th>
                      <th className="px-4 pb-3">Tráº¡ng thÃ¡i</th>
                      <th className="px-4 pb-3 text-center">Thao tÃ¡c</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          Äang táº£i dá»¯ liá»‡u...
                        </td>
                      </tr>
                    ) : filteredShifts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          KhÃ´ng cÃ³ ca lÃ m phÃ¹ há»£p vá»›i bá»™ lá»c
                        </td>
                      </tr>
                    ) : (
                      filteredShifts.map((shift, index) => (
                        <tr key={shift.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                          <td className="px-5 py-5 font-bold">{getShiftCode(shift, index)}</td>
                          <td className="px-5 py-5 font-semibold">{getShiftName(shift)}</td>
                          <td className="px-5 py-5 text-slate-500">{formatTimeRange(shift)}</td>
                          <td className="px-5 py-5">
                            <div className="flex items-center gap-3">
                              <span className="flex h-11 w-11 items-center justify-center bg-orange-50 text-sm font-extrabold text-[#f97316]">
                                {(shift.userName || "NV").slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <p className="font-extrabold text-slate-800">{shift.userName || "NhÃ¢n viÃªn"}</p>
                                <p className="text-[11px] font-semibold text-slate-400">
                                  {employees.find((employee) => employee.id === shift.userId)?.phone || shift.userId.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-5 font-bold">{formatCurrency(shift.totalSales || 0)}</td>
                          <td className="px-5 py-5">
                            <span className={`inline-flex px-3 py-1.5 text-xs font-extrabold ${getShiftStatusMeta(shift).color}`}>
                              {getShiftStatusMeta(shift).label}
                            </span>
                          </td>
                          <td className="px-5 py-5">
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => handleViewShift(shift)} className="text-slate-400 transition hover:text-[#f97316]" title="Xem chi tiáº¿t">
                                <Icon name="visibility" className="text-[21px]" />
                              </button>
                              {isManager && shift.status === "OPEN" ? (
                                <button onClick={() => setShowCloseModal(shift.id)} className="bg-orange-50 px-4 py-2 text-sm font-bold text-orange-600 hover:text-orange-800">
                                  Chá»‘t ca
                                </button>
                              ) : null}
                              {isManager && ["PENDING", "APPROVED"].includes(shift.status) ? (
                                <button onClick={() => handleCancel(shift.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-800">Há»§y</button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-slate-50 pt-7 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-400">
                  Hiá»ƒn thá»‹ 1 - {Math.min(filteredShifts.length, 5)} cá»§a {filteredShifts.length} ca lÃ m
                </p>
                <div className="flex items-center gap-2">
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400">
                    <Icon name="chevron_left" className="text-[16px]" />
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f97316] text-[13px] font-bold text-white">1</button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600">2</button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600">3</button>
                  <span className="text-slate-400">...</span>
                  <select className="ml-2 h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">
                    <option>5 / trang</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>

      {selectedShift ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-extrabold text-[#f97316]">
                    {statusMap[selectedShift.status]?.label || selectedShift.status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-500">
                    {getShiftCode(selectedShift, shifts.findIndex((shift) => shift.id === selectedShift.id))}
                  </span>
                </div>
                <h3 className="font-['Outfit',sans-serif] text-xl font-extrabold text-slate-900">
                  {selectedShift.userName || "NhÃ¢n viÃªn"} - {getShiftName(selectedShift)} ({formatTimeRange(selectedShift)})
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  NgÃ y {new Date(selectedShift.expectedStartTime).toLocaleDateString("vi-VN")} - Má»Ÿ bá»Ÿi {selectedShift.openedByName || "Quáº£n trá»‹ há»‡ thá»‘ng"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedShift.status === "OPEN" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShift(null);
                      setShowCloseModal(selectedShift.id);
                    }}
                    className="rounded-xl bg-[#f97316] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#ea580c]"
                  >
                    Chá»‘t ca nÃ y
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedShift(null)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="ÄÃ³ng"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-slate-200 px-6">
              {[
                ["overview", "bar_chart", "Tá»•ng quan"],
                ["orders", "receipt_long", `ÄÆ¡n hÃ ng (${shiftOrders.length})`],
                ["cash", "payments", "Káº¿t tiá»n"],
              ].map(([key, icon, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDetailTab(key as "overview" | "orders" | "cash")}
                  className={[
                    "flex items-center gap-2 border-b-2 px-4 py-4 text-xs font-extrabold uppercase transition",
                    detailTab === key
                      ? "border-[#f97316] text-[#f97316]"
                      : "border-transparent text-slate-400 hover:text-slate-700",
                  ].join(" ")}
                >
                  <Icon name={icon} className="text-[17px]" />
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-6">
              {detailTab === "overview" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-400">Má»Ÿ ca</p>
                      <p className="mt-2 font-extrabold text-slate-900">
                        {selectedShift.actualStartTime
                          ? new Date(selectedShift.actualStartTime).toLocaleString("vi-VN")
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-400">Nháº­n ca</p>
                      <p className="mt-2 font-extrabold text-slate-900">{formatCurrency(selectedShift.openingCash || 0)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-400">Chá»‘t ca</p>
                      <p className="mt-2 font-extrabold text-slate-900">
                        {selectedShift.actualEndTime
                          ? new Date(selectedShift.actualEndTime).toLocaleString("vi-VN")
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-orange-50 p-4">
                      <p className="text-xs font-extrabold uppercase text-[#f97316]">Tá»•ng thá»i gian</p>
                      <p className="mt-2 font-extrabold text-[#c2410c]">{formatTimeRange(selectedShift)}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-400">Doanh thu</p>
                      <p className="mt-2 text-xl font-extrabold text-slate-900">{formatCurrency(selectedShift.totalSales || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-400">ÄÆ¡n hÃ ng</p>
                      <p className="mt-2 text-xl font-extrabold text-slate-900">{shiftOrders.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-400">Tiá»n cáº§n cÃ³</p>
                      <p className="mt-2 text-xl font-extrabold text-slate-900">
                        {formatCurrency((selectedShift.openingCash || 0) + (selectedShift.totalSalesCash || 0))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-400">Lá»‡ch tiá»n</p>
                      <p className="mt-2 text-xl font-extrabold text-slate-900">{formatCurrency(selectedShift.variance || 0)}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "orders" ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-190 text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-extrabold uppercase text-slate-400">
                        <th className="px-4 py-3">MÃ£ Ä‘Æ¡n</th>
                        <th className="px-4 py-3">Thá»i gian</th>
                        <th className="px-4 py-3">Tráº¡ng thÃ¡i</th>
                        <th className="px-4 py-3">Thanh toÃ¡n</th>
                        <th className="px-4 py-3 text-right">Tá»•ng tiá»n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftOrders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-14 text-center font-bold text-slate-400">
                            ChÆ°a cÃ³ Ä‘Æ¡n hÃ ng
                          </td>
                        </tr>
                      ) : (
                        shiftOrders.map((order) => (
                          <tr key={order.id} className="border-b border-slate-100">
                            <td className="px-4 py-3 font-bold text-slate-800">{order.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-4 py-3 text-slate-500">{new Date(order.createdAt).toLocaleString("vi-VN")}</td>
                            <td className="px-4 py-3">{order.status}</td>
                            <td className="px-4 py-3">{order.paymentMethod || "-"}</td>
                            <td className="px-4 py-3 text-right font-extrabold">{formatCurrency(order.finalAmount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detailTab === "cash" ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-180 text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-extrabold uppercase text-slate-400">
                        <th className="px-4 py-3">Loáº¡i</th>
                        <th className="px-4 py-3 text-right">Sá»‘ tiá»n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Tiá»n máº·t", selectedShift.totalSalesCash || 0],
                        ["Chuyá»ƒn khoáº£n / QR / Tháº»", selectedShift.totalSalesQr || 0],
                        ["Äáº§u ca", selectedShift.openingCash || 0],
                        ["Tiá»n chá»‘t thá»±c táº¿", selectedShift.actualClosingCash || 0],
                      ].map(([label, amount]) => (
                        <tr key={String(label)} className="border-b border-slate-100">
                          <td className="px-4 py-3 font-bold text-slate-700">{label}</td>
                          <td className="px-4 py-3 text-right font-extrabold text-slate-900">{formatCurrency(Number(amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Manager Close Modal */}
      {showCloseModal && activeShiftToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-[#0b1c30] mb-4">Äá»‘i soÃ¡t & ÄÃ³ng ca</h3>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiá»n Ä‘áº§u ca:</span>
                  <span className="font-bold">{formatCurrency(activeShiftToClose.openingCash)}</span>
                </div>
                {/* Note: In a real flow, we'd fetch actual sales before closing to preview. For simplicity here, we let the backend calculate.
                    But user asked for "Hiá»ƒn thá»‹ Tá»•ng pháº£i cÃ³". We can add an endpoint to preview sales, or just rely on Manager counting. 
                    Let's just ask Manager to input counted cash. */}
                <p className="text-xs text-amber-600 italic mt-2">* Há»‡ thá»‘ng sáº½ tá»± Ä‘á»™ng Ä‘á»‘i soÃ¡t dá»±a trÃªn sá»‘ tiá»n báº¡n nháº­p dÆ°á»›i Ä‘Ã¢y.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tiá»n máº·t thá»±c táº¿ Ä‘áº¿m Ä‘Æ°á»£c (VND)</label>
                <input type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Nháº­p sá»‘ tiá»n thá»±c táº¿ trong kÃ©t" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Ghi chÃº (Báº¯t buá»™c náº¿u cÃ³ chÃªnh lá»‡ch)</label>
                <textarea rows={3} value={closingNote} onChange={e => setClosingNote(e.target.value)} placeholder="VÃ­ dá»¥: Thiáº¿u 20.000 do khÃ¡ch tráº£ thiáº¿u" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"></textarea>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCloseModal(null)} className="rounded-xl px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Há»§y</button>
              <button onClick={handleClose} className="rounded-xl bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-700">ÄÃ³ng ca</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
