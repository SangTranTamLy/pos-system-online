import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserByEmail } from "../repositories/user.repository";
import type {
  AuthTokenPayload,
  AuthUser,
  LoginRequestBody,
} from "../types/auth.types";
import { ApiError } from "../utils/apiError";

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
    throw new ApiError(401, "Email hoặc mật khẩu không hợp lệ!");
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

  return {
    token,
    user: authUser,
  };
}