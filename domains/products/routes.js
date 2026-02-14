import { Router } from "express";
import "dotenv/config.js";
import {
  createProductsController,
  getProductsController,
  updateProductController,
  deleteProductController,
} from "./controller.js";
import { authTokenMiddleware } from "../../utils/authMiddleware.js";
const router = Router();

router.post("/products", authTokenMiddleware, createProductsController);
export default router;
router.get("/products", getProductsController);
router.put("/products/:id", authTokenMiddleware, updateProductController);
router.delete("/products/:id", authTokenMiddleware, deleteProductController);
