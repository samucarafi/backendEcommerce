import { Router } from "express";
import { getShippingConfig, updateShippingConfig } from "./controllers.js";
import { adminMiddleware } from "../../utils/authMiddleware.js";
const router = Router();

router.get("/shipping-config", getShippingConfig);
router.put("/shipping-config", adminMiddleware, updateShippingConfig);

export default router;
