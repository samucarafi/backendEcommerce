import { Router } from "express";
import { authTokenMiddleware } from "../../utils/authMiddleware.js";
import {
  createPreferenceController,
  createPixController,
  webhookController,
  statusByIdController,
} from "./controllers.js";

const router = Router();

// Criar preferência Mercado Pago
router.post(
  "/create-preference",
  authTokenMiddleware,
  createPreferenceController,
);
router.post("/create-pix", createPixController);
router.post("/payment/webhook", webhookController);
router.post("status/:id", statusByIdController);
// router.post("/calculate-frete", calculateFreteController);

export default router;
