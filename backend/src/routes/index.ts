import { Router } from "express";
import authRouter from "./auth.routes";
import categoryRouter from "./category.routes";
import orderRouter from "./order.routes";
import posRouter from "./pos.routes";
import productRouter from "./product.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/pos", posRouter);
apiRouter.use("/orders", orderRouter);

export default apiRouter;
