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
  verifyEmailController,
  resendVerificationController,
  deleteUserController,
} from "./controller.js";
import { authTokenMiddleware } from "../../utils/authMiddleware.js";
const router = Router();

// Autenticação
router.post("/auth/register", registerUserController);
router.post("/auth/login", loginController);
router.get("/auth/profile", authTokenMiddleware, getProfileController);
router.post("/auth/logout", logoutController);
router.get("/auth/verify", verifyEmailController);
router.post("/auth/resend-verification", resendVerificationController);

// Usuários (Admin)
router.get("/admin/users", getUsersController); //colocar protect adminMiddleware depois de testar a rota
router.put("/admin/users/:id", updateUserController); //colocar protect adminMiddleware depois de testar a rota
router.post("/change-password", authTokenMiddleware, changePasswordController);
router.delete("/admin/users/:id", deleteUserController); //colocar protect adminMiddleware depois de testar a rota

export default router;
