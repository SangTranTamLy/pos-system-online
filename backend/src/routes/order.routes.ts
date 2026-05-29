import { Router } from "express";

const orderRouter = Router();

orderRouter.get("/", (_req, res) => {
  return res.json({
    success: true,
    message: "Order route is working",
  });
});

export default orderRouter;
