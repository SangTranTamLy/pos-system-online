import type { Request, Response } from "express";
import {
  getAllUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  updateUserStatusService,
  getAllRolesService,
} from "../services/user.service";
import { successResponse } from "../utils/apiResponse";

export async function getAllUsersController(_req: Request, res: Response) {
  const users = await getAllUsersService();
  return res.json(successResponse("Lấy danh sách nhân viên thành công", users));
}

export async function getUserByIdController(req: Request, res: Response) {
  const { id } = req.params;
  const user = await getUserByIdService(id as string);
  return res.json(successResponse("Lấy thông tin nhân viên thành công", user));
}

export async function createUserController(req: Request, res: Response) {
  const user = await createUserService(req.body);
  return res.status(201).json(successResponse("Tạo nhân viên thành công", user));
}

export async function updateUserController(req: Request, res: Response) {
  const { id } = req.params;
  const user = await updateUserService(id as string, req.body);
  return res.json(successResponse("Cập nhật nhân viên thành công", user));
}

export async function updateUserStatusController(req: Request, res: Response) {
  const { id } = req.params;
  const { isActive } = req.body;
  await updateUserStatusService(id as string, isActive);
  return res.json(successResponse(isActive ? "Đã mở khóa nhân viên" : "Đã khóa nhân viên thành công", null));
}

export async function getAllRolesController(_req: Request, res: Response) {
  const roles = await getAllRolesService();
  return res.json(successResponse("Lấy danh sách quyền thành công", roles));
}
