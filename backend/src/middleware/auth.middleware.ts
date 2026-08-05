import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload, AuthUser } from "../types/auth.types";
import { ApiError } from "../utils/apiError";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2/promise";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError(500, "Thiếu JWT_SECRET");
  }

  return secret;
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "Thiếu mã truy cập");
  }

  const token = authorization.replace("Bearer ", "");

  let payload: AuthTokenPayload;

  try {
    payload = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Phiên đăng nhập đã hết hạn");
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, "Mã truy cập không hợp lệ");
    }

    throw error;
  }

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT u.id, u.full_name, u.email, u.role_id, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.is_active = 1
     LIMIT 1`,
    [payload.userId]
  );
  const user = rows[0];

  if (!user) {
    throw new ApiError(401, "Tài khoản không còn hoạt động");
  }

  req.user = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    roleId: user.role_id,
    roleName: user.role_name,
  };

  next();
}

export function requireRoles(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Chưa được xác thực");
    }

    const userRole = req.user.roleName.trim().toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map((role) => role.trim().toUpperCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      throw new ApiError(403, "Bạn không có quyền thực hiện thao tác này");
    }

    next();
  };
}
