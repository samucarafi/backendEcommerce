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

    cpfEncrypted: String, // 🔐 AES criptografado (para exibição)
    cpfHash: String, // 🔑 SHA-256 hash para buscas (não reversível)

    addresses: [addressSchema],

    /**
     * usedCoupons – histórico de cupons utilizados.
     *
     * ⚠️  REGRA DE NEGÓCIO:
     *   - O cupom "PRIMEIRACOMPRA" só pode ser usado UMA vez por CPF.
     *     A verificação usa `cpfHash` para garantir mesmo que o usuário
     *     troque de conta.
     *   - Todos os outros cupons (afiliados) podem ser usados livremente
     *     (sem restrição por CPF, apenas o mesmo usuário não pode usar
     *     duas vezes seguidas se você quiser – mas hoje está livre).
     */
    usedCoupons: [
      {
        code: String,
        usedAt: { type: Date, default: Date.now },
      },
    ],

    affiliate: {
      couponCode: { type: String, unique: true, sparse: true },

      discountPercentage: { type: Number, default: 5 },
      commissionPercentage: { type: Number, default: 5 },

      totalEarned: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
    },

    dateOfBirth: Date,
  },
  { timestamps: true },
);

// Índice para busca de hash de CPF (usado na validação do PRIMEIRACOMPRA)
UserSchema.index({ cpfHash: 1 });

export default mongoose.model("User", UserSchema);
