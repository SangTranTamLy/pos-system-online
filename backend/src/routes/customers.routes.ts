import { Router } from "express";
import {
  createCustomerController,
  deleteCustomerController,
  getCustomerOrdersController,
  getCustomersController,
  searchCustomersController,
  getCustomerController,
  updateCustomerController,
} from "../controllers/customers.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const customersRouter = Router();

customersRouter.use(authMiddleware);
customersRouter.get("/", asyncHandler(getCustomersController));
customersRouter.get("/search", asyncHandler(searchCustomersController));
customersRouter.post("/", asyncHandler(createCustomerController));
customersRouter.get("/:id/orders", asyncHandler(getCustomerOrdersController));
customersRouter.get("/:id", asyncHandler(getCustomerController));
customersRouter.put("/:id", asyncHandler(updateCustomerController));
customersRouter.delete("/:id", asyncHandler(deleteCustomerController));

export default customersRouter;
