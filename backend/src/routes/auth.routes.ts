import { Router } from "express";
import {
  loginController, meController, loginPinController
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const authRouter = Router();

authRouter.post("/login", asyncHandler(loginController));
authRouter.post("/login-pin", asyncHandler(loginPinController));
authRouter.get("/me", authMiddleware, asyncHandler(meController));

export default authRouter;