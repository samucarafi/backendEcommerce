import { Router } from "express";
import UserRouters from "../domains/users/routes.js";
import ProductRouters from "../domains/products/routes.js";
import PaymentsRouters from "../domains/payments/routes.js";
const router = Router();
router.use("/", UserRouters);
router.use("/", ProductRouters);
router.use("/", PaymentsRouters);
export default router;
