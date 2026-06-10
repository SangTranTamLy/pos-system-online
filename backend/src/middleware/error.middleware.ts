import type { ErrorRequestHandler, RequestHandler } from "express";
import { ApiError } from "../utils/apiError";

export const notFoundMiddleware: RequestHandler = (req, res, next) => {
  void res;
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

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

  res.status(500).json({
    success: false,
    message: "Máy chủ bị lỗi!",
  });
};
