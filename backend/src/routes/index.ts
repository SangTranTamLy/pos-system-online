import { Router } from "express";
import authRouter from "./auth.routes";
import productRouter from "./product.routes";
import categoryRouter from "./category.routes";
import orderRouter from "./order.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/orders", orderRouter);

export default apiRouter;
