import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  items: Array,
  totalAmount: Number,
  shippingAddress: Object,
  shipping: Object,
  payment: { type: String, default: "pix" },
  pixPayload: String,
  pixPaid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const Order = mongoose.model("Order", orderSchema);
