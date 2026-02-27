import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    password: String,
    role: {
      type: String,
      default: "user",
    },
    verified: {
      type: Boolean,
      default: false,
    },

    phone: String,
    cpf: {
      type: String,
      unique: true,
      sparse: true, // permite null
    },
    dateOfBirth: Date,
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("User", UserSchema);
