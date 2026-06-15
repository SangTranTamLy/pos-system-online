import type { NextFunction, Request, Response } from "express";

export function asyncHandler(
  controller: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(controller(req, res, next)).catch(next);
  };
}