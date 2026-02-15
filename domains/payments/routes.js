import { Router } from "express";
import { authTokenMiddleware } from "../../utils/authMiddleware.js";
import { createPreferenceController } from "./controllers.js";

const router = Router();

// Criar preferência Mercado Pago
router.post(
  "/create-preference",
  authTokenMiddleware,
  createPreferenceController,
);

export default router;
