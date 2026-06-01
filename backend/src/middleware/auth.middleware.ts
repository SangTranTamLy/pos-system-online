import type { NextFunction, Request, Response } from "express";
import type { AuthTokenPayload,AuthUser } from "../types/auth.types";
import { ApiError } from "../utils/apiError";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
function getJwtSecret(){
  const secret = process.env.JWT_SECRET;

  if(!secret){
    throw new ApiError(500, "Thiếu JWT_SECRET")
  }
  return secret;
}
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing access token");
  }

  const token = authorization.replace("Bearer ", "");
  const payload = jwt.verify(
    token, getJwtSecret()
  ) as AuthTokenPayload;
  req.user = {
    id: payload.userId,
    fullName: payload.fullName,
    email:payload.email,
    roleId: payload.roleId,
    roleName: payload.roleName,
  };
  next();
}

export function requireRoles(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthenticated");
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      throw new ApiError(403, "Forbidden");
    }

    next();
  };
}
