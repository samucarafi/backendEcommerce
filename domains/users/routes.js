import { Router } from "express";
import "dotenv/config.js";
import {
  getProfileController,
  loginController,
  registerUserController,
  updateUserController,
  changePasswordController,
  getUsersController,
  verifyEmailController,
  resendVerificationController,
  deleteUserController,
  updateMyProfileController,
  forgotPasswordController,
  resetPasswordController,
  validateCouponController,
  updateAffiliateController,
  payAffiliateController,
  googleLoginController,
} from "./controller.js";
import {
  adminMiddleware,
  authTokenMiddleware,
} from "../../utils/authMiddleware.js";
const router = Router();

// Autenticação
router.post("/auth/register", registerUserController);
router.post("/auth/login", loginController);
router.post("/auth/google", googleLoginController);
router.get("/auth/profile", authTokenMiddleware, getProfileController);
router.put("/auth/profile", authTokenMiddleware, updateMyProfileController);
router.get("/auth/verify", verifyEmailController);
router.post("/auth/resend-verification", resendVerificationController);
router.post("/auth/forgot-password", forgotPasswordController);
router.post("/auth/reset-password", resetPasswordController);
router.post("/coupons/validate", validateCouponController);
// Usuários (Admin)
router.get(
  "/admin/users",
  authTokenMiddleware,
  adminMiddleware,
  getUsersController,
); //colocar protect adminMiddleware depois de testar a rota
router.put(
  "/admin/users/:id",
  authTokenMiddleware,
  adminMiddleware,
  updateUserController,
); //colocar protect adminMiddleware depois de testar a rota
router.post("/change-password", authTokenMiddleware, changePasswordController);
router.delete(
  "/admin/users/:id",
  authTokenMiddleware,
  adminMiddleware,
  deleteUserController,
); //colocar protect adminMiddleware depois de testar a rota
router.put(
  "/admin/affiliate/:userId",
  authTokenMiddleware,
  adminMiddleware,
  updateAffiliateController,
);

router.post(
  "/admin/affiliate/:userId/pay",
  authTokenMiddleware,
  adminMiddleware,
  payAffiliateController,
);
export default router;
