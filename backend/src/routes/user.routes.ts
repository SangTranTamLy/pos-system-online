import { Router } from "express";
import {
  getAllUsersController,
  getUserByIdController,
  createUserController,
  updateUserController,
  updateUserStatusController,
  getAllRolesController,
} from "../controllers/user.controller";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const userRouter = Router();

// Phân quyền cho tất cả các API phía dưới: Chỉ Admin mới có quyền thao tác với tài khoản
userRouter.use(authMiddleware);
userRouter.use(requireRoles(["ADMIN", "MANAGER"])); // Cho phép manager nếu muốn, ở đây tạm thời cho cả MANAGER hoặc chỉ ADMIN

// Quản lý roles
userRouter.get("/roles", asyncHandler(getAllRolesController));

// CRUD Users
userRouter.get("/", asyncHandler(getAllUsersController));
userRouter.get("/:id", asyncHandler(getUserByIdController));
userRouter.post("/", asyncHandler(createUserController));
userRouter.put("/:id", asyncHandler(updateUserController));
userRouter.patch("/:id/status", asyncHandler(updateUserStatusController));

export default userRouter;
