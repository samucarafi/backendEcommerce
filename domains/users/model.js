import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    cep: String,
    street: String,
    number: String,
    neighborhood: String,
    city: String,
    state: String,
    complement: String,
  },
  { _id: true },
);

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,
    lastVerificationEmail: Date,
    role: { type: String, default: "user" },
    verified: { type: Boolean, default: false },

    phone: String,

    cpfEncrypted: String, // 🔐 agora criptografado
    addresses: [addressSchema], // 📦 múltiplos endereços
    usedCoupons: [
      {
        code: String,
        usedAt: { type: Date, default: Date.now },
      },
    ],
    affiliate: {
      couponCode: {
        type: String,
        unique: true,
      },

      discountPercentage: {
        type: Number,
        default: 5,
      },

      commissionPercentage: {
        type: Number,
        default: 5,
      },

      totalEarned: {
        type: Number,
        default: 0, // histórico total (NUNCA zera)
      },

      pendingBalance: {
        type: Number,
        default: 0, // 💰 saldo atual a pagar
      },

      totalPaid: {
        type: Number,
        default: 0, // 💸 total já pago
      },
    },
    dateOfBirth: Date,
  },
  { timestamps: true },
);

export default mongoose.model("User", UserSchema);
