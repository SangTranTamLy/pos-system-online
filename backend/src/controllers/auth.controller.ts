import type { Request, Response } from "express";
import { loginService, loginPinService } from "../services/auth.service";
import type { LoginRequestBody, LoginPinRequestBody } from "../types/auth.types";
import { successResponse } from "../utils/apiResponse";

export async function loginController(req: Request, res: Response) {
  const result = await loginService(req.body as LoginRequestBody);

  return res.json(successResponse("Login successful", result));
}

export async function meController(req: Request, res: Response) {
  return res.json(successResponse("Authenticated user", req.user));
}

export async function loginPinController(req: Request, res: Response) {
  const result = await loginPinService(req.body as LoginPinRequestBody);

  return res.json(successResponse("Login successful", result));
}
