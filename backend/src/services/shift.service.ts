import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../utils/apiError";
import * as shiftRepo from "../repositories/shift.repository";
import { Shift } from "../types/shift.types";

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
    throw new ApiError(409, "Thời gian đăng ký bị trùng lặp với ca làm việc khác");
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

  return (await shiftRepo.findShiftById(id))!;
};

export const requestCloseShift = async (id: string, userId: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (shift.userId !== userId) throw new ApiError(403, "Chỉ nhân viên của ca mới được yêu cầu đóng ca");
  if (shift.status !== 'OPEN') throw new ApiError(400, "Chỉ có thể yêu cầu đóng ca đang mở");

  await shiftRepo.updateShiftStatus(id, 'CLOSING_REQUEST', {
    actual_end_time: new Date()
  });

  return (await shiftRepo.findShiftById(id))!;
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

  return (await shiftRepo.findShiftById(id))!;
};

export const cancelShift = async (id: string): Promise<Shift> => {
  const shift = await shiftRepo.findShiftById(id);
  if (!shift) throw new ApiError(404, "Không tìm thấy ca làm việc");
  if (['CLOSED', 'CANCELLED'].includes(shift.status)) {
    throw new ApiError(400, "Ca này không thể hủy");
  }

  await shiftRepo.updateShiftStatus(id, 'CANCELLED');

  return (await shiftRepo.findShiftById(id))!;
};
