import { Router } from "express";
import UserRouters from "../domains/users/routes.js";
import ProductRouters from "../domains/products/routes.js";
const router = Router();
router.use("/", UserRouters);
router.use("/", ProductRouters);

export default router;
