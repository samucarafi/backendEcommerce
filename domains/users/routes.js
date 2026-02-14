import { Router } from "express";
import "dotenv/config.js";
import {
  getProfileController,
  loginController,
  logoutController,
  registerUserController,
  updateUserController,
  changePasswordController,
  getUsersController,
} from "./controller.js";
import { authTokenMiddleware } from "../../utils/authMiddleware.js";
const router = Router();

// Autenticação
router.post("/auth/register", registerUserController);
router.post("/auth/login", loginController);
router.get("/auth/profile", authTokenMiddleware, getProfileController);
router.post("/auth/logout", logoutController);

// Usuários (Admin)
router.get("/admin/users", authTokenMiddleware, getUsersController);
router.put("/admin/users/:id", authTokenMiddleware, updateUserController);
router.post("/change-password", authTokenMiddleware, changePasswordController);

export default router;
