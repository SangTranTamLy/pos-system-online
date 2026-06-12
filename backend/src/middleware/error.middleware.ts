import type { ErrorRequestHandler, RequestHandler } from "express";
import { ApiError } from "../utils/apiError";

export const notFoundMiddleware: RequestHandler = (req, res, next) => {
  void res;
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

type MysqlError = Error & {
  code?: string;
  sqlMessage?: string;
};

function mapDatabaseError(error: MysqlError): ApiError | null {
  switch (error.code) {
    case "ER_BAD_FIELD_ERROR":
    case "ER_NO_SUCH_TABLE":
      return new ApiError(
        500,
        `Cấu trúc database chưa khớp với code: ${
          error.sqlMessage ?? error.message
        }. Hãy chạy lại backend/src/database/schema.sql và backend/src/database/migration-sync-orders.sql`
      );
    case "ER_CHECK_CONSTRAINT_VIOLATED":
      return new ApiError(
        400,
        "Dữ liệu đơn hàng không hợp lệ (vi phạm ràng buộc dữ liệu trong database)"
      );
    case "ER_NO_REFERENCED_ROW_2":
      return new ApiError(
        400,
        "Dữ liệu tham chiếu không tồn tại (sản phẩm/khách hàng/nhân viên không có trong database)"
      );
    case "ECONNREFUSED":
    case "PROTOCOL_CONNECTION_LOST":
    case "ETIMEDOUT":
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_BAD_DB_ERROR":
      return new ApiError(
        500,
        "Không kết nối được MySQL. Kiểm tra MySQL Server đang chạy và cấu hình trong file .env"
      );
    default:
      return null;
  }
}

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  console.error(error);

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  const dbError = mapDatabaseError(error as MysqlError);

  if (dbError) {
    res.status(dbError.statusCode).json({
      success: false,
      message: dbError.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Máy chủ bị lỗi!",
  });
};
