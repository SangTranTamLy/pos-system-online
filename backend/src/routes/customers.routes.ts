import { Router } from "express";
import {
  searchCustomersController,
  getCustomerController,
} from "../controllers/customers.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const customersRouter = Router();

customersRouter.use(authMiddleware);
customersRouter.get("/search", asyncHandler(searchCustomersController));
customersRouter.get("/:id", asyncHandler(getCustomerController));

export default customersRouter;
