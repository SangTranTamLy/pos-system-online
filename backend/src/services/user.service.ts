import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  findAllUsers,
  findUserById,
  findUserByEmail,
  createUser,
  updateUser,
  updateUserPassword,
  updateUserStatus,
  getAllRoles,
} from "../repositories/user.repository";
import { ApiError } from "../utils/apiError";
import type { DatabaseUser } from "../types/auth.types";

export interface CreateUserInput {
  fullName: string;
  email: string;
  password?: string;
  roleId: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  fullName: string;
  email: string;
  roleId: string;
  isActive: boolean;
  password?: string;
}

export async function getAllUsersService(): Promise<DatabaseUser[]> {
  return await findAllUsers();
}

export async function getUserByIdService(id: string): Promise<DatabaseUser> {
  const user = await findUserById(id);
  if (!user) {
    throw new ApiError(404, "Không tìm thấy nhân viên");
  }
  return user;
}

export async function createUserService(input: CreateUserInput): Promise<DatabaseUser> {
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    throw new ApiError(400, "Email đã được sử dụng");
  }

  const id = crypto.randomUUID();
  const passwordToHash = input.password || "123456";
  const passwordHash = await bcrypt.hash(passwordToHash, 10);
  const isActive = input.isActive !== undefined ? input.isActive : true;

  await createUser(id, input.fullName, input.email, passwordHash, input.roleId, isActive);

  const newUser = await findUserById(id);
  if (!newUser) {
    throw new ApiError(500, "Lỗi khi tạo nhân viên");
  }
  return newUser;
}

export async function updateUserService(id: string, input: UpdateUserInput): Promise<DatabaseUser> {
  const user = await findUserById(id);
  if (!user) {
    throw new ApiError(404, "Không tìm thấy nhân viên");
  }

  if (input.email !== user.email) {
    const existingUser = await findUserByEmail(input.email);
    if (existingUser) {
      throw new ApiError(400, "Email đã được sử dụng bởi người khác");
    }
  }

  await updateUser(id, input.fullName, input.email, input.roleId, input.isActive);

  if (input.password && input.password.trim() !== "") {
    const passwordHash = await bcrypt.hash(input.password, 10);
    await updateUserPassword(id, passwordHash);
  }

  const updatedUser = await findUserById(id);
  return updatedUser!;
}

export async function updateUserStatusService(id: string, isActive: boolean): Promise<void> {
  const user = await findUserById(id);
  if (!user) {
    throw new ApiError(404, "Không tìm thấy nhân viên");
  }

  await updateUserStatus(id, isActive);
}

export async function getAllRolesService() {
  return await getAllRoles();
}
