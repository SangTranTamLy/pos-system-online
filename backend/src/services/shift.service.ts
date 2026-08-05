import { v4 as uuidv4 } from "uuid";
import { createAuditLog } from "../repositories/audit-log.repository";
import * as shiftRepo from "../repositories/shift.repository";
import { findUserById } from "../repositories/user.repository";
import {
  Shift,
  ShiftBucketKey,
  ShiftRevenueSummaryItem,
  StaffByShiftSummaryItem,
} from "../types/shift.types";
import { ApiError } from "../utils/apiError";

export const getShifts = async (userId?: string): Promise<Shift[]> => {
  return shiftRepo.findShifts(userId);
};

const shiftBucketLabels: Record<ShiftBucketKey, string> = {
  morning: "Ca sáng (06:00 - 14:00)",
  afternoon: "Ca chiều (14:00 - 22:00)",
  night: "Ca tối (22:00 - 06:00)",
};

function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

export const getShiftRevenueSummary = async (
  days = 7
): Promise<ShiftRevenueSummaryItem[]> => {
  const normalizedDays = Math.min(Math.max(Number(days) || 7, 1), 31);
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - normalizedDays + 1);

  const startDate = formatDateKey(start);
  const endDate = formatDateKey(end);
  const rows = await shiftRepo.findShiftRevenueByBucket(startDate, endDate);

  const summary = new Map<string, ShiftRevenueSummaryItem>();
  for (let index = 0; index < normalizedDays; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = formatDateKey(date);
    summary.set(dateKey, {
      date: dateKey,
      label: formatDateLabel(dateKey),
      morning: 0,
      afternoon: 0,
      night: 0,
      total: 0,
    });
  }

  for (const row of rows) {
    const item = summary.get(row.date);
    if (!item) continue;
    item[row.bucket] = row.revenue;
    item.total = item.morning + item.afternoon + item.night;
  }

  return Array.from(summary.values());
};

export const getStaffByShiftSummary = async (
  date = formatDateKey(new Date())
): Promise<StaffByShiftSummaryItem[]> => {
  const rows = await shiftRepo.countStaffByShiftBucket(date);
  const activeStaffTotal = await shiftRepo.countActiveShiftStaff();
  const assignedByBucket = new Map(rows.map((row) => [row.bucket, row.assigned]));
  const largestAssigned = Math.max(0, ...rows.map((row) => row.assigned));
  const total = Math.max(activeStaffTotal, largestAssigned);

  return (["morning", "afternoon", "night"] as ShiftBucketKey[]).map((key) => {
    const assigned = assignedByBucket.get(key) || 0;
    const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0;
    return {
      key,
      label: shiftBucketLabels[key],
      assigned,
      total,
      percentage,
    };
  });
};

export const registerShift = async (
  userId: string,
  startTime: string,
  endTime: string
): Promise<Shift> => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, "Thời gian ca làm không hợp lệ");
  }

  if (start >= end) {
    throw new ApiError(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }

  const isOverlap = await shiftRepo.checkOverlappingShifts(userId, start, end);
  if (isOverlap) {
    throw new ApiError(409, "Thời gian ca làm bị trùng với ca làm khác");
  }

  const id = uuidv4();
  await shiftRepo.createShift(id, userId, start, end);

  const newShift = await shiftRepo.findShiftById(id);
  if (!newShift) throw new ApiError(500, "Không thể tạo ca làm");
  return newShift;
};

export const openShiftForEmployee = async (
  userId: string,
  managerId: string,
  startTime: string,
  endTime: string
): Promise<Shift> => {
  const employee = await findUserById(userId);
  if (!employee || !employee.isActive) {
    throw new ApiError(404, "Không tìm thấy nhân viên đang hoạt động");
  }
  const roleName = employee.roleName.trim().toLowerCase();
  if (!["staff", "cashier"].includes(roleName)) {
    throw new ApiError(400, "Chỉ có thể mở ca cho tài khoản nhân viên");
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, "Thời gian ca làm không hợp lệ");
  }

  if (start >= end) {
    throw new ApiError(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }

  const hasOpenShift = await shiftRepo.checkOpenShiftExists(userId);
  if (hasOpenShift) {
    throw new ApiError(409, "Nhân viên này đang có ca làm chưa kết thúc");
  }

  const isOverlap = await shiftRepo.checkOverlappingShifts(userId, start, end);
  if (isOverlap) {
    throw new ApiError(409, "Thời gian ca làm bị trùng với ca làm khác");
  }

  const id = uuidv4();
  await shiftRepo.createOpenShiftForEmployee(id, userId, start, end, managerId);

  const openedShift = await shiftRepo.findShiftById(id);
  if (!openedShift) throw new ApiError(500, "Không thể mở ca cho nhân viên");

  void createAuditLog(
    managerId,
    "MO_CA",
    `Ca làm: ${openedShift.userName || "Nhân viên"}`,
    `Quản lý phê duyệt và mở ca trực tiếp cho nhân viên ${openedShift.userName || "Không rõ"}. Nhân viên sẽ nhập tiền đầu ca trước khi bán hàng.`,
    null,
    openedShift
  );

  return openedShift;
};

export const approveShift = async (id: string, managerId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm");
  if (shift.status !== "PENDING") throw new ApiError(400, "Chỉ có thể duyệt ca đang chờ");

  await shiftRepo.updateShiftStatus(id, "APPROVED", {
    approved_by: managerId,
  });

  return (await shiftRepo.findShiftById(id))!;
};

export const requestOpenShift = async (
  id: string,
  userId: string,
  openingCash: number
): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm");
  if (shift.userId !== userId) throw new ApiError(403, "Chỉ nhân viên của ca mới được yêu cầu mở ca");
  if (shift.status !== "APPROVED") throw new ApiError(400, "Chỉ có thể yêu cầu mở ca đã được duyệt");
  if (openingCash < 0) throw new ApiError(400, "Tiền mặt đầu ca không được âm");

  const hasOpenShift = await shiftRepo.checkOpenShiftExists(shift.userId, shift.id);
  if (hasOpenShift) {
    throw new ApiError(409, "Nhân viên này đang có ca làm chưa kết thúc");
  }

  await shiftRepo.updateShiftStatus(id, "OPENING_REQUEST", {
    opening_cash: openingCash,
  });

  return (await shiftRepo.findShiftById(id))!;
};

export const setOpeningCash = async (
  id: string,
  userId: string,
  openingCash: number
): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm");
  if (shift.userId !== userId) throw new ApiError(403, "Chỉ nhân viên của ca mới được nhập tiền đầu ca");
  if (shift.status !== "OPEN") throw new ApiError(400, "Chỉ có thể nhập tiền đầu ca cho ca đang mở");
  if (shift.openingCash > 0) throw new ApiError(400, "Ca này đã nhập tiền đầu ca");
  if (openingCash <= 0) throw new ApiError(400, "Tiền đầu ca phải lớn hơn 0");

  await shiftRepo.updateShiftStatus(id, "OPEN", {
    opening_cash: openingCash,
  });

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  void createAuditLog(
    userId,
    "NHAP_TIEN_DAU_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    `Nhân viên nhập tiền đầu ca: ${openingCash.toLocaleString("vi-VN")}đ và bắt đầu bán hàng.`,
    shift,
    updatedShift
  );

  return updatedShift;
};

export const openShift = async (id: string, managerId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm");
  if (shift.status !== "OPENING_REQUEST") {
    throw new ApiError(400, "Chỉ có thể xác nhận mở ca đang yêu cầu mở");
  }

  const hasOpenShift = await shiftRepo.checkOpenShiftExists(shift.userId, shift.id);
  if (hasOpenShift) {
    throw new ApiError(409, "Nhân viên này đang có ca làm chưa kết thúc");
  }

  await shiftRepo.updateShiftStatus(id, "OPEN", {
    opened_by: managerId,
    actual_start_time: new Date(),
  });

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  void createAuditLog(
    managerId,
    "MO_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    `Duyệt mở ca thành công. Nhân viên ca: ${updatedShift.userName || "Không rõ"}. Tiền mặt đầu ca: ${updatedShift.openingCash.toLocaleString("vi-VN")}đ.`,
    shift,
    updatedShift
  );

  return updatedShift;
};

export const requestCloseShift = async (id: string, userId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm");
  if (shift.userId !== userId) throw new ApiError(403, "Chỉ nhân viên của ca mới được yêu cầu đóng ca");
  if (shift.status !== "OPEN") throw new ApiError(400, "Chỉ có thể yêu cầu đóng ca đang mở");

  await shiftRepo.updateShiftStatus(id, "CLOSING_REQUEST", {
    actual_end_time: new Date(),
  });

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  void createAuditLog(
    userId,
    "YEU_CAU_DONG_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    "Nhân viên gửi yêu cầu đóng ca.",
    shift,
    updatedShift
  );

  return updatedShift;
};

export const closeShift = async (
  id: string,
  managerId: string,
  actualClosingCash: number,
  closingNote?: string
): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm");
  if (!["OPEN", "CLOSING_REQUEST"].includes(shift.status)) {
    throw new ApiError(400, "Chỉ có thể chốt ca đang mở");
  }
  if (actualClosingCash < 0) throw new ApiError(400, "Tiền mặt chốt ca không được âm");

  const updatedShift = await shiftRepo.closeShiftTransaction(
    id,
    managerId,
    actualClosingCash,
    closingNote
  );
  const totalSales = updatedShift.totalSales;
  const variance = updatedShift.variance;
  const direction = variance >= 0 ? "Thừa" : "Thiếu";

  void createAuditLog(
    managerId,
    "XAC_NHAN_DONG_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    `Xác nhận đóng ca thành công. Nhân viên ca: ${updatedShift.userName || "Không rõ"}. Doanh thu ca: ${totalSales.toLocaleString("vi-VN")}đ. Tiền mặt chốt ca: ${actualClosingCash.toLocaleString("vi-VN")}đ. Chênh lệch: ${direction} ${Math.abs(variance).toLocaleString("vi-VN")}đ.${closingNote ? ` Ghi chú: ${closingNote}` : ""}`,
    shift,
    updatedShift
  );

  return updatedShift;
};

export const cancelShift = async (id: string, userId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm");
  if (["CLOSED", "CANCELLED"].includes(shift.status)) {
    throw new ApiError(400, "Ca này không thể hủy");
  }
  if (shift.status === "OPEN") {
    const { totalCash, totalQr } = await shiftRepo.calculateShiftSales(id);
    const hasStartedSelling =
      Number(shift.openingCash || 0) > 0 ||
      Number(shift.totalSales || 0) > 0 ||
      totalCash + totalQr > 0;

    if (hasStartedSelling) {
      throw new ApiError(400, "Không thể hủy ca khi nhân viên đã bắt đầu bán hàng");
    }
  }

  await shiftRepo.updateShiftStatus(id, "CANCELLED");

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  void createAuditLog(
    userId,
    "HUY_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    `Hủy ca làm đăng ký ngày ${new Date(updatedShift.expectedStartTime).toLocaleDateString("vi-VN")}.`,
    shift,
    updatedShift
  );

  return updatedShift;
};
