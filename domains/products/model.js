import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    price: Number,
    description: String,
    image: String,
    stock: Number,

    // categoria olfativa
    category: {
      type: String,
      enum: [
        "Floral",
        "Amadeirado",
        "Oriental",
        "Cítrico",
        "Aromático",
        "Gourmand",
      ],
    },

    // tipo de produto
    type: {
      type: String,
      enum: ["Perfume", "Decante"],
      required: true,
    },

    // gênero
    gender: {
      type: String,
      enum: ["Masculino", "Feminino", "Unissex"],
    },

    // lançamento
    isNew: {
      type: Boolean,
      default: false,
    },

    // marca
    brand: String,

    weight: Number,
    popularity: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Product", ProductSchema);
