import { model, Schema } from "mongoose";

const OrderSchema = new Schema({
  orderNumber: {
    type: String,
    unique: true,
  },
  owner: { type: Schema.Types.ObjectId, ref: "User" },
  preferenceId: { type: String, required: true },
  items: { type: Object, required: true },
});

export default model("Order", OrderSchema);
