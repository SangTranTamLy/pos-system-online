import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserByEmail } from "../repositories/user.repository";
import { findAllActiveUsersWithRoles } from "../repositories/user.repository";
import type {
  AuthTokenPayload,
  AuthUser,
  LoginRequestBody,
  LoginPinRequestBody,
} from "../types/auth.types";
import { ApiError } from "../utils/apiError";
import { createAuditLog } from "../repositories/audit-log.repository";

interface LoginResult {
  token: string;
  user: AuthUser;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError(500, "Bị thiếu JWT_SECRET");
  }

  return secret;
}

function validateLoginInput(body: LoginRequestBody) {
  if (!body.email || !body.password) {
    throw new ApiError(400, "Cần có email và mật khẩu.");
  }
}

export async function loginService(
  body: LoginRequestBody
): Promise<LoginResult> {
  validateLoginInput(body);

  const user = await findUserByEmail(body.email);

  if (!user) {
    throw new ApiError(401, "Email hoặc mật khẩu không hợp lệ!");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Tài khoản đã bị khóa");
  }

  const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, "Mật khẩu không chính xác!");
  }

  const roleName = user.roleName.toLowerCase();
  if (roleName !== "admin" && roleName !== "manager") {
    throw new ApiError(403, "Tab này chỉ dành cho Quản trị viên hoặc Quản lý");
  }

  const authUser: AuthUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    roleName: user.roleName,
  };

  const payload: AuthTokenPayload = {
    userId: authUser.id,
    email: authUser.email,
    fullName: authUser.fullName,
    roleId: authUser.roleId,
    roleName: authUser.roleName,
  };

  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: "1d",
  });

  // Log successful login
  void createAuditLog(
    authUser.id,
    "DANG_NHAP",
    "Thiết bị POS",
    "Đăng nhập hệ thống (Email)"
  );

  return {
    token,
    user: authUser,
  };
}

export async function loginPinService(
  body: LoginPinRequestBody
): Promise<LoginResult> {
  if (!body.pin || body.pin.length !== 6) {
    throw new ApiError(400, "Mã PIN phải bao gồm 6 chữ số.");
  }

  const activeUsers = await findAllActiveUsersWithRoles();

  for (const user of activeUsers) {
    if (user.pinCode) {
      const isMatch = await bcrypt.compare(body.pin, user.pinCode);
      if (isMatch) {
        const roleName = user.roleName.toLowerCase();
        if (roleName === "admin" || roleName === "manager") {
          throw new ApiError(403, "Tài khoản Quản lý không được phép đăng nhập bằng mã PIN");
        }

        const authUser: AuthUser = {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          roleId: user.roleId,
          roleName: user.roleName,
        };

        const payload: AuthTokenPayload = {
          userId: authUser.id,
          email: authUser.email,
          fullName: authUser.fullName,
          roleId: authUser.roleId,
          roleName: authUser.roleName,
        };

        const token = jwt.sign(payload, getJwtSecret(), {
          expiresIn: "1d",
        });

        // Log successful PIN login
        void createAuditLog(
          authUser.id,
          "DANG_NHAP",
          "Thiết bị POS",
          "Đăng nhập hệ thống (Mã PIN)"
        );

        return {
          token,
          user: authUser,
        };
      }
    }
  }

  throw new ApiError(401, "Mã PIN không chính xác!");
}