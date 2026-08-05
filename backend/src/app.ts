import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import { db } from "./config/database";
import apiRouter from "./routes";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middleware/error.middleware";

dotenv.config();

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin không được phép truy cập API."));
  },
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// Chặn các thao tác ghi (POST, PUT, PATCH, DELETE) đối với tài khoản demo để bảo vệ dữ liệu gốc
app.use((req, res, next) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.replace("Bearer ", "");
    try {
      const payload = jwt.decode(token);
      if (payload && typeof payload === "object" && payload.email === "demo@example.com") {
        const isWriteMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
        // Cho phép các endpoint auth (như đăng nhập, lấy thông tin cá nhân)
        const isAuthRoute = req.path.startsWith("/api/auth");
        if (isWriteMethod && !isAuthRoute) {
          return res.status(403).json({
            success: false,
            message: "Tài khoản demo chỉ có quyền xem dữ liệu (Read-only) để tránh làm thay đổi dữ liệu gốc của hệ thống!"
          });
        }
      }
    } catch (e) {
      // Bỏ qua lỗi decode, để auth.middleware.ts xác thực chính thức sau
    }
  }
  next();
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (_req, res) => {
  return res.json({
    success: true,
    message: "QuickServe POS API is running",
    endpoints: {
      health: "/health",
      api: "/api",
    },
  });
});

app.get("/health", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS status");

    return res.json({
      success: true,
      message: "MySQL đã kết nối",
      data: rows,
    });
  } catch (error) {
    console.error("MYSQL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "MySQL kết nối thất bại.",
    });
  }
});

app.get("/api/health", (_req, res) => {
  return res.json({ ok: true, time: new Date() });
});

app.use("/api", apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

// Tránh tiến trình Node chết hẳn (gây ERR_CONNECTION_REFUSED) khi có lỗi không được bắt
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

app.listen(PORT, () => {
  console.log(`Server đang chạy trên ${PORT}`);
});
