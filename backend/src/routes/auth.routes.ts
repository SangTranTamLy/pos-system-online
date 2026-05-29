import { Router } from "express";

const authRouter = Router();

authRouter.get("/", (_req, res) => {
  return res.json({
    success: true,
    message: "Auth route is working",
  });
});

export default authRouter;
