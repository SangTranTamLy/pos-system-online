import { Router } from "express";

const categoryRouter = Router();

categoryRouter.get("/", (_req, res) => {
  return res.json({
    success: true,
    message: "Category route is working",
  });
});

export default categoryRouter;
