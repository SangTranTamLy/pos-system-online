import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { db } from "../config/database";
import {
  getAllUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  updateUserStatusService,
  getAllRolesService,
} from "../services/user.service";
import { successResponse } from "../utils/apiResponse";

async function logUserAction(
  performer: any,
  actionType: string,
  targetObject: string,
  description: string
) {
  try {
    const roleCode = performer.roleName.trim().toUpperCase() === "ADMIN" || performer.roleName.trim().toUpperCase() === "MANAGER" ? "QL" : "TN";
    await db.query(
      `
      INSERT INTO audit_logs (id, user_id, user_name, role, action_type, target_object, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        performer.id,
        performer.fullName,
        roleCode,
        actionType,
        targetObject,
        description
      ]
    );
  } catch (err) {
    console.error("Lỗi khi ghi audit log nhân viên:", err);
  }
}

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
  
  if (req.user) {
    const roleLabel = user.roleName === "admin" ? "Quản trị viên" : (user.roleName === "manager" ? "Quản lý" : "Thu ngân");
    const description = `Tạo mới nhân viên: ${user.fullName}. Email/SĐT: ${user.email || user.phone || "Không có"}. Vai trò: ${roleLabel}. Trạng thái: ${user.isActive ? "Hoạt động" : "Khóa"}.`;
    await logUserAction(req.user, "SUA_NHAN_VIEN", user.fullName, description);
  }

  return res.status(201).json(successResponse("Tạo nhân viên thành công", user));
}

export async function updateUserController(req: Request, res: Response) {
  const { id } = req.params;
  const user = await updateUserService(id as string, req.body);

  if (req.user) {
    const roleLabel = user.roleName === "admin" ? "Quản trị viên" : (user.roleName === "manager" ? "Quản lý" : "Thu ngân");
    const description = `Cập nhật thông tin nhân viên: ${user.fullName}. Email/SĐT: ${user.email || user.phone || "Không có"}. Vai trò: ${roleLabel}. Trạng thái: ${user.isActive ? "Hoạt động" : "Khóa"}.`;
    await logUserAction(req.user, "SUA_NHAN_VIEN", user.fullName, description);
  }

  return res.json(successResponse("Cập nhật nhân viên thành công", user));
}

export async function updateUserStatusController(req: Request, res: Response) {
  const { id } = req.params;
  const { isActive } = req.body;
  await updateUserStatusService(id as string, isActive);

  // Lấy thông tin nhân viên sau khi cập nhật để ghi log tên đầy đủ
  try {
    const user = await getUserByIdService(id as string);
    if (req.user && user) {
      const statusLabel = isActive ? "Hoạt động" : "Khóa tài khoản";
      const description = `Thay đổi trạng thái nhân viên ${user.fullName} thành: ${statusLabel}.`;
      await logUserAction(req.user, "SUA_NHAN_VIEN", user.fullName, description);
    }
  } catch (err) {
    console.error("Lỗi khi tìm nhân viên để log status update:", err);
  }

  return res.json(successResponse(isActive ? "Đã mở khóa nhân viên" : "Đã khóa nhân viên thành công", null));
}

export async function getAllRolesController(_req: Request, res: Response) {
  const roles = await getAllRolesService();
  return res.json(successResponse("Lấy danh sách quyền thành công", roles));
}
