import express from "express";
import {
  createCheckoutController,
  getAllOrders,
  getMyOrders,
  getPaymentLink,
  updateDeliveryStatus,
  webhookController,
} from "./controllers.js";
import {
  adminMiddleware,
  authTokenMiddleware,
} from "../../utils/authMiddleware.js";

const router = express.Router();

router.get("/orders", authTokenMiddleware, getMyOrders);
router.get("/orders/:id/pay", authTokenMiddleware, getPaymentLink);
router.post("/checkout", authTokenMiddleware, createCheckoutController);
router.get("/admin/orders", authTokenMiddleware, adminMiddleware, getAllOrders);
router.patch(
  "/admin/orders/:id/status",
  authTokenMiddleware,
  adminMiddleware,
  updateDeliveryStatus,
);
router.get("/payment/:id/link", authTokenMiddleware, getPaymentLink);
router.post("/payment/webhook", webhookController);

export default router;
