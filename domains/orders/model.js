import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  orderId: String,

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  customer: {
    name: String,
    email: String,
  },

  items: [
    {
      title: String,
      quantity: Number,
      unit_price: Number,
    },
  ],

  totals: {
    items: Number,
    shipping: Number,
    total: Number,
  },

  shippingAddress: {
    cep: String,
    street: String,
    number: String,
    neighborhood: String,
    city: String,
    state: String,
    complement: String,
  },

  payment: {
    method: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    mpPaymentId: String,
    mpPreferenceId: String,
  },

  deliveryStatus: {
    type: String,
    enum: ["processing", "sent", "delivered"],
    default: "processing",
  },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Order", orderSchema);
