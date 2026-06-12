import { Router } from "express";
import authRouter from "./auth.routes";
import categoryRouter from "./category.routes";
import orderRouter from "./order.routes";
import posRouter from "./pos.routes";
import productRouter from "./product.routes";
import dashboardRouter from "./dashboard.routes";
import customersRouter from "./customers.routes";
const apiRouter = Router();
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/pos", posRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/invoices", orderRouter);
apiRouter.use("/customers", customersRouter);

export default apiRouter;
