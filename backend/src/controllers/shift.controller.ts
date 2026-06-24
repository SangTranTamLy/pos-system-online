import type { Request, Response } from "express";
import * as shiftService from "../services/shift.service";
import { AuthUser } from "../types/auth.types";

export const getShiftsController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const isManagerOrAdmin = ["ADMIN", "MANAGER"].includes(user.roleName.toUpperCase());
  const userIdQuery = isManagerOrAdmin ? undefined : user.id;

  const shifts = await shiftService.getShifts(userIdQuery);
  res.json({ success: true, data: shifts });
};

export const getShiftRevenueSummaryController = async (req: Request, res: Response) => {
  const days = req.query.days ? Number(req.query.days) : 7;
  const summary = await shiftService.getShiftRevenueSummary(days);
  res.json({ success: true, data: summary });
};

export const getStaffByShiftSummaryController = async (req: Request, res: Response) => {
  const date = req.query.date ? String(req.query.date) : undefined;
  const summary = await shiftService.getStaffByShiftSummary(date);
  res.json({ success: true, data: summary });
};

export const registerShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { expectedStartTime, expectedEndTime } = req.body;

  const shift = await shiftService.registerShift(user.id, expectedStartTime, expectedEndTime);
  res.status(201).json({ success: true, message: "Tạo ca làm thành công", data: shift });
};

export const openShiftForEmployeeController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { userId, expectedStartTime, expectedEndTime, openingCash } = req.body;

  const shift = await shiftService.openShiftForEmployee(
    String(userId || ""),
    user.id,
    expectedStartTime,
    expectedEndTime,
    Number(openingCash) || 0
  );

  res.status(201).json({ success: true, message: "Mo ca cho nhan vien thanh cong", data: shift });
};

export const approveShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const shift = await shiftService.approveShift(req.params.id as string, user.id);
  res.json({ success: true, message: "Duyệt ca thành công", data: shift });
};

export const requestOpenShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { openingCash } = req.body;
  const shift = await shiftService.requestOpenShift(
    req.params.id as string,
    user.id,
    Number(openingCash) || 0
  );
  res.json({ success: true, message: "Đã gửi yêu cầu mở ca", data: shift });
};

export const setOpeningCashController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { openingCash } = req.body;
  const shift = await shiftService.setOpeningCash(
    req.params.id as string,
    user.id,
    Number(openingCash) || 0
  );
  res.json({ success: true, message: "Đã nhập tiền đầu ca", data: shift });
};

export const openShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const shift = await shiftService.openShift(req.params.id as string, user.id);
  res.json({ success: true, message: "Mở ca thành công", data: shift });
};

export const requestCloseShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const shift = await shiftService.requestCloseShift(req.params.id as string, user.id);
  res.json({ success: true, message: "Đã gửi yêu cầu đóng ca", data: shift });
};

export const closeShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { actualClosingCash, closingNote } = req.body;
  const shift = await shiftService.closeShift(
    req.params.id as string,
    user.id,
    Number(actualClosingCash) || 0,
    closingNote ? String(closingNote) : undefined
  );
  res.json({ success: true, message: "Đóng ca thành công", data: shift });
};

export const cancelShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const shift = await shiftService.cancelShift(req.params.id as string, user.id);
  res.json({ success: true, message: "Hủy ca thành công", data: shift });
};
