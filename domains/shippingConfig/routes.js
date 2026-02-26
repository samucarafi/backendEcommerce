import { Router } from "express";
import { getShippingConfig, updateShippingConfig } from "./controllers.js";
import { adminMiddleware } from "../../utils/authMiddleware.js";
const router = Router();

router.get("/shipping-config", getShippingConfig);
router.put("/shipping-config", updateShippingConfig); //colocar protect adminMiddleware depois de testar a rota

export default router;
