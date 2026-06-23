import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../utils/apiError";
import * as shiftRepo from "../repositories/shift.repository";
import { Shift } from "../types/shift.types";

import { createAuditLog } from "../repositories/audit-log.repository";

export const getShifts = async (userId?: string): Promise<Shift[]> => {
  return shiftRepo.findShifts(userId);
};

export const registerShift = async (
  userId: string,
  startTime: string,
  endTime: string
): Promise<Shift> => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    throw new ApiError(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }

  const isOverlap = await shiftRepo.checkOverlappingShifts(userId, start, end);
  if (isOverlap) {
    throw new ApiError(409, "Thời gian ca làm bị trùng lặp với ca làm việc khác");
  }

  const id = uuidv4();
  await shiftRepo.createShift(id, userId, start, end);
  
  const newShift = await shiftRepo.findShiftById(id);
  if (!newShift) throw new ApiError(500, "Lỗi khi tạo ca làm việc");
  return newShift;
};

export const approveShift = async (id: string, managerId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (shift.status !== 'PENDING') throw new ApiError(400, "Chỉ có thể duyệt ca đang chờ");

  await shiftRepo.updateShiftStatus(id, 'APPROVED', {
    approved_by: managerId
  });

  return (await shiftRepo.findShiftById(id))!;
};

export const requestOpenShift = async (id: string, userId: string, openingCash: number): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (shift.userId !== userId) throw new ApiError(403, "Chỉ nhân viên của ca mới được yêu cầu mở ca");
  if (shift.status !== 'APPROVED') throw new ApiError(400, "Chỉ có thể yêu cầu mở ca đã được duyệt");

  const hasOpenShift = await shiftRepo.checkOpenShiftExists(shift.userId);
  if (hasOpenShift) {
    throw new ApiError(409, "Nhân viên này đang có ca làm việc chưa kết thúc");
  }

  await shiftRepo.updateShiftStatus(id, 'OPENING_REQUEST', {
    opening_cash: openingCash
  });

  return (await shiftRepo.findShiftById(id))!;
};

export const openShift = async (id: string, managerId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (shift.status !== 'OPENING_REQUEST') throw new ApiError(400, "Chỉ có thể xác nhận mở ca cho ca đang yêu cầu mở");

  const hasOpenShift = await shiftRepo.checkOpenShiftExists(shift.userId);
  if (hasOpenShift) {
    throw new ApiError(409, "Nhân viên này đang có ca làm việc chưa kết thúc");
  }

  await shiftRepo.updateShiftStatus(id, 'OPEN', {
    opened_by: managerId,
    actual_start_time: new Date()
  });

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  // Ghi nhật ký hoạt động mở ca
  void createAuditLog(
    managerId,
    "MO_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    `Duyệt mở ca làm việc thành công. Nhân viên ca: ${updatedShift.userName || "Không rõ"}. Số tiền mặt đầu ca: ${updatedShift.openingCash.toLocaleString("vi-VN")}đ.`,
    shift,
    updatedShift
  );

  return updatedShift;
};

export const requestCloseShift = async (id: string, userId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (shift.userId !== userId) throw new ApiError(403, "Chỉ nhân viên của ca mới được yêu cầu đóng ca");
  if (shift.status !== 'OPEN') throw new ApiError(400, "Chỉ có thể yêu cầu đóng ca đang mở");

  await shiftRepo.updateShiftStatus(id, 'CLOSING_REQUEST', {
    actual_end_time: new Date()
  });

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  // Ghi nhật ký yêu cầu đóng ca
  void createAuditLog(
    userId,
    "YEU_CAU_DONG_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    `Nhân viên gửi yêu cầu đóng ca làm việc.`,
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
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (shift.status !== 'CLOSING_REQUEST') throw new ApiError(400, "Chỉ có thể đóng ca đang yêu cầu đóng");

  // Calculate sales
  const { totalCash, totalQr } = await shiftRepo.calculateShiftSales(id);
  const totalSales = totalCash + totalQr;
  
  // Logic: Expected Cash = Opening Cash + Total Cash Sales
  const expectedCash = shift.openingCash + totalCash;
  const variance = actualClosingCash - expectedCash;

  await shiftRepo.updateShiftStatus(id, 'CLOSED', {
    closed_by: managerId,
    actual_closing_cash: actualClosingCash,
    total_sales_cash: totalCash,
    total_sales_qr: totalQr,
    total_sales: totalSales,
    variance: variance,
    closing_note: closingNote || null
  });

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  // Ghi nhật ký xác nhận đóng ca
  const directionStr = variance >= 0 ? "Thừa" : "Thiếu";
  const desc = `Xác nhận đóng ca làm việc thành công. Nhân viên ca: ${updatedShift.userName || "Không rõ"}. Doanh thu ca: ${totalSales.toLocaleString("vi-VN")}đ. Tiền mặt chốt két: ${actualClosingCash.toLocaleString("vi-VN")}đ (Chênh lệch: ${directionStr} ${Math.abs(variance).toLocaleString("vi-VN")}đ).${closingNote ? ` Ghi chú: ${closingNote}` : ""}`;

  void createAuditLog(
    managerId,
    "XAC_NHAN_DONG_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    desc,
    shift,
    updatedShift
  );

  return updatedShift;
};

export const cancelShift = async (id: string, userId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (['CLOSED', 'CANCELLED'].includes(shift.status)) {
    throw new ApiError(400, "Ca này không thể hủy");
  }

  await shiftRepo.updateShiftStatus(id, 'CANCELLED');

  const updatedShift = (await shiftRepo.findShiftById(id))!;

  // Ghi nhật ký hủy ca
  void createAuditLog(
    userId,
    "HUY_CA",
    `Ca làm: ${updatedShift.userName || "Nhân viên"}`,
    `Hủy ca làm việc đăng ký ngày ${new Date(updatedShift.expectedStartTime).toLocaleDateString("vi-VN")}.`,
    shift,
    updatedShift
  );

  return updatedShift;
};
