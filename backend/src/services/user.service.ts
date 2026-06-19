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
  findAllActiveUsersWithRoles,
} from "../repositories/user.repository";
import { ApiError } from "../utils/apiError";
import type { DatabaseUser } from "../types/auth.types";

export interface CreateUserInput {
  fullName: string;
  email: string;
  phone: string;
  pinCode: string;
  password?: string;
  roleId: string;
  isActive?: boolean;
}

export interface UpdateUserInput {
  fullName: string;
  email: string;
  phone?: string;
  pinCode?: string;
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
  const roles = await getAllRoles();
  const role = roles.find((r: any) => r.id === input.roleId);
  const roleName = role ? role.name.toLowerCase() : "";

  let finalEmail = null;
  let finalPasswordHash = null;
  let finalPhone = null;
  let finalPinCodeHash = null;

  if (roleName === "admin" || roleName === "manager") {
    if (!input.email || !input.password) {
      throw new ApiError(400, "Quản trị viên và Quản lý yêu cầu Email và Mật khẩu");
    }
    const existingUser = await findUserByEmail(input.email);
    if (existingUser) {
      throw new ApiError(400, "Email đã được sử dụng");
    }
    finalEmail = input.email;
    const salt = await bcrypt.genSalt(10);
    finalPasswordHash = await bcrypt.hash(input.password, salt);
  } else {
    // Thu ngân (cashier / staff)
    if (!input.phone || !input.pinCode || input.pinCode.length !== 6) {
      throw new ApiError(400, "Nhân viên yêu cầu Số điện thoại và Mã PIN 6 chữ số hợp lệ");
    }
    
    if (!/^0\d{9}$/.test(input.phone)) {
      throw new ApiError(400, "Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0");
    }

    // Check for duplicate phone number and PIN
    const activeUsers = await findAllActiveUsersWithRoles();
    for (const u of activeUsers) {
      if (u.phone === input.phone) {
        throw new ApiError(400, "Số điện thoại này đã được sử dụng bởi một nhân viên khác!");
      }
      if (u.pinCode) {
        const isMatch = await bcrypt.compare(input.pinCode, u.pinCode);
        if (isMatch) {
          throw new ApiError(400, "Mã PIN này đã được sử dụng bởi một nhân viên khác! Vui lòng chọn mã PIN khác.");
        }
      }
    }

    finalPhone = input.phone;
    const salt = await bcrypt.genSalt(10);
    finalPinCodeHash = await bcrypt.hash(input.pinCode, salt);
  }

  const id = crypto.randomUUID();
  const isActive = input.isActive !== undefined ? input.isActive : true;

  await createUser(id, input.fullName, finalEmail, finalPasswordHash, finalPhone, finalPinCodeHash, input.roleId, isActive);

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

  const roles = await getAllRoles();
  const role = roles.find((r: any) => r.id === input.roleId);
  const roleName = role ? role.name.toLowerCase() : "";

  let finalEmail: string | null = user.email;
  let finalPhone: string | null = user.phone;
  let hashedPin: string | null = null;
  
  if (roleName === "admin" || roleName === "manager") {
    if (!input.email) {
      throw new ApiError(400, "Vui lòng cung cấp Email");
    }
    if (input.email !== user.email) {
      const existingUser = await findUserByEmail(input.email);
      if (existingUser && existingUser.id !== id) {
        throw new ApiError(400, "Email đã được sử dụng bởi người khác");
      }
    }
    finalEmail = input.email;
    finalPhone = null; // Quản lý không có SĐT đăng nhập
    hashedPin = null;

    if (input.password && input.password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(input.password, salt);
      await updateUserPassword(id, hash);
    }
  } else {
    // Thu ngân (cashier / staff)
    if (!input.phone) {
      throw new ApiError(400, "Vui lòng cung cấp Số điện thoại");
    }
    if (!/^0\d{9}$/.test(input.phone)) {
      throw new ApiError(400, "Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng số 0");
    }
    finalEmail = null;
    finalPhone = input.phone;
    
    if (input.pinCode && input.pinCode.trim() !== "") {
      if (input.pinCode.length !== 6) {
        throw new ApiError(400, "Mã PIN phải có đúng 6 chữ số");
      }
      
      
      // Check for duplicate phone number and PIN
      const activeUsers = await findAllActiveUsersWithRoles();
      for (const u of activeUsers) {
        if (u.id !== id) {
          if (u.phone === input.phone) {
            throw new ApiError(400, "Số điện thoại này đã được sử dụng bởi một nhân viên khác!");
          }
          if (u.pinCode) {
            const isMatch = await bcrypt.compare(input.pinCode, u.pinCode);
            if (isMatch) {
              throw new ApiError(400, "Mã PIN này đã được sử dụng bởi một nhân viên khác! Vui lòng chọn mã PIN khác.");
            }
          }
        }
      }

      const salt = await bcrypt.genSalt(10);
      hashedPin = await bcrypt.hash(input.pinCode, salt);
    } else {
      // Still need to check for duplicate phone number even if PIN wasn't changed
      const activeUsers = await findAllActiveUsersWithRoles();
      for (const u of activeUsers) {
        if (u.id !== id && u.phone === input.phone) {
          throw new ApiError(400, "Số điện thoại này đã được sử dụng bởi một nhân viên khác!");
        }
      }
    }
  }

  await updateUser(id, input.fullName, finalEmail, input.roleId, input.isActive, finalPhone, hashedPin);

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
