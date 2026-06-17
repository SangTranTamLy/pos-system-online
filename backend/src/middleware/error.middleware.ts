import type { ErrorRequestHandler, RequestHandler } from "express";
import { ApiError } from "../utils/apiError";

export const notFoundMiddleware: RequestHandler = (req, res, next) => {
  void res;
  next(new ApiError(404, `Không tìm thấy đường dẫn: ${req.method} ${req.originalUrl}`));
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
        }. Hãy kiểm tra và chạy các file migration cần thiết trong backend/src/database.`
      );
    case "ER_DUP_ENTRY":
      return new ApiError(
        409,
        "Thông tin đã tồn tại. Vui lòng kiểm tra lại dữ liệu vừa nhập."
      );
    case "ER_DATA_TOO_LONG":
      return new ApiError(
        400,
        "Dữ liệu nhập quá dài. Vui lòng rút gọn tên, số điện thoại, email hoặc địa chỉ."
      );
    case "ER_CHECK_CONSTRAINT_VIOLATED":
      return new ApiError(
        400,
        "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin."
      );
    case "ER_NO_REFERENCED_ROW_2":
      return new ApiError(
        400,
        "Sản phẩm, khách hàng hoặc nhân viên không tồn tại. Vui lòng kiểm tra lại thông tin."
      );
    case "ECONNREFUSED":
    case "PROTOCOL_CONNECTION_LOST":
    case "ETIMEDOUT":
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_BAD_DB_ERROR":
      return new ApiError(
        500,
        "Hệ thống đang gặp sự cố. Vui lòng thử lại sau."
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
    message: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
  });
};
