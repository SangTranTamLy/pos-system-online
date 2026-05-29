import { Router } from "express";

const productRouter = Router();

productRouter.get("/", (_req, res) => {
  return res.json({
    success: true,
    message: "Product route is working",
  });
});

export default productRouter;
