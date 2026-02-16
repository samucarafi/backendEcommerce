import express from "express";
import {
  createCheckoutController,
  createOrder,
  getAllOrders,
  getMyOrders,
  updateDeliveryStatus,
  webhookController,
} from "./controllers.js";
import {
  adminMiddleware,
  authTokenMiddleware,
} from "../../utils/authMiddleware.js";

const router = express.Router();

router.post("/orders", authTokenMiddleware, createOrder);
router.get("/orders", authTokenMiddleware, getMyOrders);
router.post("/checkout", createCheckoutController);
router.get("/admin/orders", adminMiddleware, getAllOrders);
router.patch("/admin/orders/:id/status", adminMiddleware, updateDeliveryStatus);

router.post("/payment/webhook", webhookController);

export default router;
