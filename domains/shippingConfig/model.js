import mongoose from "mongoose";

const ShippingConfigSchema = new mongoose.Schema(
  {
    shippingByState: {
      type: Map,
      of: Number,
      required: true,
    },
    freeShippingMinValue: {
      type: Number,
      default: 0,
    },
    extraDays: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

export default mongoose.model("ShippingConfig", ShippingConfigSchema);
