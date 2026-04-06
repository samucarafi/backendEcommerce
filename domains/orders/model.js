import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  customer: {
    name: String,
    email: String,
  },

  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: false,
      },
      title: String,
      quantity: Number,
      unit_price: Number,
      type: {
        type: String,
        enum: ["product", "discount", "shipping"],
        default: "product",
      },
    },
  ],

  coupon: {
    code: String,
    type: {
      type: String,
      enum: ["percentage", "fixed", "shipping", "affiliate", null],
      default: null,
    },
    value: Number,
    applied: {
      type: Boolean,
      default: false,
    },
  },

  totals: {
    items: Number,
    subtotal: Number,
    discount: {
      type: Number,
      default: 0,
    },
    originalShipping: {
      type: Number,
      default: 0,
    },
    shippingDiscount: {
      type: Number,
      default: 0,
    },
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
    pix: {
      qr_code: String,
      qr_code_base64: String,
      ticket_url: String,
    },
    mpPaymentId: String,
    mpPreferenceId: String,
  },

  deliveryStatus: {
    type: String,
    enum: ["processing", "sent", "delivered"],
    default: "processing",
  },

  affiliate: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    couponCode: String,
    discountGiven: Number,
    commissionPercentage: Number,
    commissionValue: Number,
    status: {
      type: String,
      enum: ["pending", "approved", "paid"],
      default: "pending",
    },
  },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Order", orderSchema);
