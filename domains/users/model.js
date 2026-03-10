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

    dateOfBirth: Date,
  },
  { timestamps: true },
);

export default mongoose.model("User", UserSchema);
