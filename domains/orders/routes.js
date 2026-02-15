import express from "express";
import {
  createOrder,
  generatePix,
  confirmPixPayment,
} from "./controllers/orderController.js";

const router = express.Router();

router.post("/orders", createOrder);
router.post("/orders/:orderId/pix", generatePix);
router.post("/orders/:orderId/pix/confirm", confirmPixPayment);

export default router;
