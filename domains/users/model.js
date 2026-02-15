import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    password: String,
    role: String,
    verified: Boolean,
  },
  {
    timestamps: true,
  },
);
export default mongoose.model("User", UserSchema);
