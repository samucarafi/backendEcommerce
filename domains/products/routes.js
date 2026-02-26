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

router.post("/products", createProductsController);
export default router; //colocar protect adminMiddleware depois de testar a rota
router.get("/products", getProductsController);
router.put("/products/:id", updateProductController); //colocar protect adminMiddleware depois de testar a rota
router.delete("/products/:id", deleteProductController); //colocar protect adminMiddleware depois de testar a rota
