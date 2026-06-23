import type { Request, Response } from "express";
import * as shiftService from "../services/shift.service";
import { AuthUser } from "../types/auth.types";

export const getShiftsController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  // If staff, only see their own shifts. Managers/Admins see all.
  const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(user.roleName.toUpperCase());
  const userIdQuery = isManagerOrAdmin ? undefined : user.id;
  
  const shifts = await shiftService.getShifts(userIdQuery);
  res.json({ success: true, data: shifts });
};

export const registerShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { expectedStartTime, expectedEndTime } = req.body;
  
  const shift = await shiftService.registerShift(user.id, expectedStartTime, expectedEndTime);
  res.status(201).json({ success: true, message: "Tạo ca làm thành công", data: shift });
};

export const approveShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const shift = await shiftService.approveShift(req.params.id as string, user.id);
  res.json({ success: true, message: "Duyệt ca thành công", data: shift });
};

export const requestOpenShiftController = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const { openingCash } = req.body;
  const shift = await shiftService.requestOpenShift(req.params.id as string, user.id, Number(openingCash) || 0);
  res.json({ success: true, message: "Đã gửi yêu cầu mở ca", data: shift });
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
