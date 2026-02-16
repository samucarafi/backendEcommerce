import { Router } from "express";
import { authTokenMiddleware } from "../../utils/authMiddleware.js";
import {
  createPixController,
  webhookController,
  statusByIdController,
  createCheckoutController,
} from "./controllers.js";

const router = Router();

// Criar preferência Mercado Pago
router.post("/create-checkout", createCheckoutController);
router.post("/create-pix", createPixController);
router.post("/payment/webhook", webhookController);
router.post("status/:id", statusByIdController);
// router.post("/calculate-frete", calculateFreteController);

export default router;
