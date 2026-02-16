import { Router } from "express";
import UserRouters from "../domains/users/routes.js";
import ProductRouters from "../domains/products/routes.js";
import OrdersRouters from "../domains/orders/routes.js";
const router = Router();
router.use("/", UserRouters);
router.use("/", ProductRouters);
router.use("/", OrdersRouters);
export default router;
