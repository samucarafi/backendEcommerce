/**
 * modules/users/controller.js
 *
 * Alterações relacionadas ao PRIMEIRACOMPRA:
 *  - validateCouponController agora exige CPF no body
 *    e verifica via cpfHash se o PRIMEIRACOMPRA já foi usado.
 *  - updateMyProfileController salva cpfHash ao salvar CPF.
 *  - hashCPF importado do utilitário central.
 */

import User from "./model.js";
import bcrypt from "bcryptjs";
import "dotenv/config.js";
import {
  JWTSign,
  JWTSignEmailVerification,
  JWTVerifyEmailToken,
  JWTSignPasswordReset,
  JWTVerifyPasswordReset,
} from "../../utils/jwt.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../services/emailService.js";
import {
  decryptCPF,
  encryptCPF,
  hashCPF,
  maskCPF,
} from "../../utils/cpfCrypto.js";
import { formatName } from "../../utils/formatName.js";
import { OAuth2Client } from "google-auth-library";
import Order from "../orders/model.js";

const bcryptSalt = bcrypt.genSaltSync();
const FIRST_PURCHASE_COUPON = "PRIMEIRACOMPRA";

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
}
const frontend = getFrontendUrl();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */

function generateCoupon(name) {
  const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = normalize(name)
    .trim()
    .split(" ")
    .slice(0, 2)
    .join("")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 10);
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

function buildUserResponse(user, cpfMasked = "") {
  return {
    hasPassword: !!user.password,
    name: user.name,
    email: user.email,
    affiliate: user.affiliate,
    addresses: user.addresses,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    cpfMasked,
    role: user.role,
  };
}

/* ─────────────────────────────────────────────────────────
   Auth
───────────────────────────────────────────────────────── */

export const registerUserController = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail }))
      return res.status(409).json({ error: "E-mail já cadastrado" });

    const formattedName = formatName(name);
    const encryptedPassword = bcrypt.hashSync(password, bcryptSalt);

    const userDoc = await User.create({
      name: formattedName,
      email: normalizedEmail,
      password: encryptedPassword,
      affiliate: { couponCode: generateCoupon(name) },
      role: "user",
      verified: false,
    });

    const verificationToken = await JWTSignEmailVerification(userDoc._id);
    try {
      await sendVerificationEmail(normalizedEmail, verificationToken);
    } catch (e) {
      console.error("Erro ao enviar email:", e);
    }

    return res.status(201).json({ message: "Conta criada!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao registrar usuário" });
  }
};

export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ error: "E-mail/senha incorreta" });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "E-mail/senha incorreta" });

    if (!user.verified)
      return res
        .status(401)
        .json({ error: "Verifique seu email antes de acessar sua conta." });

    const token = await JWTSign({
      _id: user._id,
      name: user.name,
      role: user.role,
    });

    let cpfMasked = "";
    if (user.cpfEncrypted) {
      cpfMasked = maskCPF(decryptCPF(user.cpfEncrypted));
    }

    return res.json({
      message: "Login bem-sucedido",
      token,
      expiresIn: "2h",
      user: buildUserResponse(user, cpfMasked),
    });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const googleLoginController = async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, name } = ticket.getPayload();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: null,
        verified: true,
        affiliate: { couponCode: generateCoupon(name) },
        role: "user",
      });
    }

    const tokenJWT = await JWTSign({
      _id: user._id,
      name: user.name,
      role: user.role,
    });

    let cpfMasked = "";
    if (user.cpfEncrypted) cpfMasked = maskCPF(decryptCPF(user.cpfEncrypted));

    return res.json({
      message: "Login bem-sucedido",
      token: tokenJWT,
      expiresIn: "2h",
      user: buildUserResponse(user, cpfMasked),
    });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Token inválido" });
  }
};

/* ─────────────────────────────────────────────────────────
   Profile
───────────────────────────────────────────────────────── */

export const getProfileController = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user._id).lean();
    if (!userDoc)
      return res.status(404).json({ error: "Usuário não encontrado" });

    let cpfMasked = "";
    if (userDoc.cpfEncrypted)
      cpfMasked = maskCPF(decryptCPF(userDoc.cpfEncrypted));

    res.json({
      message: "Perfil enviado com sucesso",
      user: buildUserResponse(userDoc, cpfMasked),
    });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const updateMyProfileController = async (req, res) => {
  try {
    const { name, email, phone, cpf, dateOfBirth } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    // Email duplicado
    if (email && email !== user.email) {
      const normalized = email.toLowerCase().trim();
      if (await User.findOne({ email: normalized }))
        return res.status(400).json({ error: "E-mail já em uso" });
    }

    // CPF – verifica duplicidade via hash
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, "");
      const newHash = hashCPF(cleanCpf);
      const duplicate = await User.findOne({
        cpfHash: newHash,
        _id: { $ne: user._id },
      });
      if (duplicate)
        return res.status(400).json({ error: "CPF já cadastrado" });

      user.cpfEncrypted = encryptCPF(cleanCpf);
      user.cpfHash = newHash;
    }

    user.name = name ? formatName(name) : user.name;
    user.email = email ? email.toLowerCase().trim() : user.email;
    user.phone = phone ?? user.phone;
    user.dateOfBirth = dateOfBirth ?? user.dateOfBirth;

    await user.save();

    const cpfMasked = user.cpfEncrypted
      ? maskCPF(decryptCPF(user.cpfEncrypted))
      : "";

    res.json({
      message: "Perfil atualizado com sucesso",
      user: {
        hasPassword: !!user.password,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        cpfMasked,
        verified: user.verified,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
};

/* ─────────────────────────────────────────────────────────
   Coupon validation
   
   PRIMEIRACOMPRA → requer CPF no body; verifica via cpfHash
                    se já foi usado em qualquer pedido aprovado.
   Afiliado       → não verifica CPF; só bloqueia dono.
───────────────────────────────────────────────────────── */
export const validateCouponController = async (req, res) => {
  try {
    const { code, cpf } = req.body;
    if (!code) return res.status(400).json({ error: "Cupom não informado" });

    const couponCode = code.trim().toUpperCase();

    // ── PRIMEIRACOMPRA ──────────────────────────────────
    if (couponCode === FIRST_PURCHASE_COUPON) {
      if (!cpf) {
        return res.status(400).json({
          error: "Informe seu CPF para usar o cupom PRIMEIRACOMPRA.",
          requiresCpf: true,
        });
      }

      const cleanCpf = cpf.replace(/\D/g, "");
      const hash = hashCPF(cleanCpf);

      const alreadyUsed = await Order.findOne({
        "coupon.code": FIRST_PURCHASE_COUPON,
        "coupon.cpfHash": hash,
        "payment.status": "approved",
      }).lean();

      if (alreadyUsed) {
        return res
          .status(400)
          .json({ error: "Este CPF já utilizou o cupom PRIMEIRACOMPRA." });
      }

      return res.json({
        coupon: {
          code: FIRST_PURCHASE_COUPON,
          type: "percentage",
          value: 10, // mesma % do backend
        },
      });
    }

    // ── Afiliado ─────────────────────────────────────────
    const affiliateUser = await User.findOne({
      "affiliate.couponCode": couponCode,
    });
    if (!affiliateUser)
      return res.status(404).json({ error: "Cupom inválido" });

    if (affiliateUser._id.equals(req.user._id))
      return res
        .status(400)
        .json({ error: "Você não pode usar seu próprio cupom." });

    return res.json({
      coupon: {
        code: affiliateUser.affiliate.couponCode,
        type: "percentage",
        value: affiliateUser.affiliate.discountPercentage,
        affiliateUserId: affiliateUser._id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao validar cupom" });
  }
};

/* ─────────────────────────────────────────────────────────
   Admin – Users
───────────────────────────────────────────────────────── */

export const getUsersController = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password -cpfEncrypted -cpfHash -__v")
      .lean();
    res.json({ message: "Usuários retornados", users });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const updateUserController = async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Acesso negado" });

    const { id } = req.params;
    const { role } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    user.role = role;
    await user.save();

    res.json({ message: "Usuário atualizado", user });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const deleteUserController = async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Acesso negado" });

    const { id } = req.params;
    if (id === String(req.user._id))
      return res
        .status(400)
        .json({ error: "Você não pode deletar sua própria conta." });

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ error: "Usuário não encontrado." });

    res.json({ message: "Usuário deletado.", user: deleted });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

/* ─────────────────────────────────────────────────────────
   Affiliate management (admin)
───────────────────────────────────────────────────────── */

export const updateAffiliateController = async (req, res) => {
  try {
    const { userId } = req.params;
    const { couponCode, discountPercentage, commissionPercentage } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    if (couponCode) {
      const code = couponCode.toUpperCase();
      const exists = await User.findOne({
        "affiliate.couponCode": code,
        _id: { $ne: userId },
      });
      if (exists) return res.status(400).json({ error: "Cupom já existe" });
      user.affiliate.couponCode = code;
    }
    if (discountPercentage !== undefined)
      user.affiliate.discountPercentage = Number(discountPercentage);
    if (commissionPercentage !== undefined)
      user.affiliate.commissionPercentage = Number(commissionPercentage);

    await user.save();
    res.json({ message: "Afiliado atualizado", affiliate: user.affiliate });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar afiliado" });
  }
};

export const payAffiliateController = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user?.affiliate)
      return res.status(404).json({ error: "Afiliado não encontrado" });

    const amount = user.affiliate.pendingBalance || 0;
    if (amount <= 0) return res.status(400).json({ error: "Nada a pagar" });

    user.affiliate.totalPaid += amount;
    user.affiliate.pendingBalance = 0;
    await user.save();

    res.json({ message: "Pagamento registrado", paid: amount });
  } catch (err) {
    res.status(500).json({ error: "Erro ao pagar afiliado" });
  }
};

/* ─────────────────────────────────────────────────────────
   Password
───────────────────────────────────────────────────────── */

export const changePasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    if (!newPassword || newPassword.length < 6)
      return res
        .status(400)
        .json({ error: "A nova senha deve ter pelo menos 6 caracteres" });
    if (newPassword !== confirmNewPassword)
      return res.status(400).json({ error: "As novas senhas não coincidem" });

    if (user.password) {
      if (!currentPassword)
        return res.status(400).json({ error: "Informe a senha atual" });
      if (!bcrypt.compareSync(currentPassword, user.password))
        return res.status(401).json({ error: "Senha atual incorreta" });
    }

    user.password = bcrypt.hashSync(newPassword, bcryptSalt);
    await user.save();
    res.json({ message: user.password ? "Senha alterada" : "Senha criada" });
  } catch (err) {
    res.status(500).json({ error: "Erro interno" });
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return res.json({
        message: "Se o email existir, enviaremos instruções.",
      });

    const token = JWTSignPasswordReset(user._id);
    await sendPasswordResetEmail(user.email, token);
    res.json({ message: "Email de recuperação enviado" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao solicitar redefinição" });
  }
};

export const resetPasswordController = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = JWTVerifyPasswordReset(token);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    user.password = bcrypt.hashSync(newPassword, bcryptSalt);
    await user.save();
    res.json({ message: "Senha redefinida com sucesso" });
  } catch (err) {
    res.status(400).json({ error: "Token inválido ou expirado" });
  }
};

/* ─────────────────────────────────────────────────────────
   Email verification
───────────────────────────────────────────────────────── */

export const verifyEmailController = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${frontend}/verified-error`);

    const decoded = await JWTVerifyEmailToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) return res.redirect(`${frontend}/verified-error`);

    if (!user.verified) {
      user.verified = true;
      await user.save();
    }
    return res.redirect(`${frontend}/verified-success`);
  } catch (err) {
    return res.redirect(`${frontend}/verified-error`);
  }
};

export const resendVerificationController = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (user.verified)
      return res.status(400).json({ error: "Conta já verificada" });

    if (
      user.lastVerificationEmail &&
      Date.now() - user.lastVerificationEmail < 60000
    )
      return res
        .status(429)
        .json({ error: "Aguarde 1 minuto antes de solicitar novamente." });

    const token = await JWTSignEmailVerification(user._id);
    await sendVerificationEmail(user.email, token);
    user.lastVerificationEmail = Date.now();
    await user.save();

    return res.json({ message: "Email reenviado" });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao reenviar email" });
  }
};
