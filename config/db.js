import "dotenv/config";

import mongoose from "mongoose";

const { MONGO_URI } = process.env;
if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables");
}
export const connectDb = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1); // Exit the process with failure
  }
};
