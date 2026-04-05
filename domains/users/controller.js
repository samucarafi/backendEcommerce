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
import { decryptCPF, encryptCPF } from "../../utils/cpfCrypto.js";
import { formatName } from "../../utils/formatName.js";
import { OAuth2Client } from "google-auth-library";

//create a hash for bcrypt
const bcryptSalt = bcrypt.genSaltSync();

function getFrontendUrl() {
  const raw = process.env.FRONTEND_URL || "";

  // separa por vírgula e pega a primeira
  const firstUrl = raw.split(",")[0].trim();

  // garante que termina sem /
  return firstUrl.replace(/\/$/, "");
}

const frontend = getFrontendUrl();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLoginController = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await User.findOne({ email });

    function generateCoupon(name) {
      const normalize = (str) =>
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const cleaned = normalize(name).trim().split(" ").slice(0, 2).join("");

      const base = cleaned
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 10);

      const random = Math.floor(1000 + Math.random() * 9000);

      return `${base}${random}`;
    }

    if (!user) {
      user = await User.create({
        name,
        email,
        password: null,
        verified: true,
        affiliate: {
          couponCode: generateCoupon(name),
        },
        role: "user",
      });
    }

    // 🔐 TOKEN (AGORA COM AWAIT)
    const tokenJWT = await JWTSign({
      _id: user._id,
      name: user.name,
      role: user.role,
    });

    // 🔒 CPF MASK (igual ao login normal)
    let cpfMasked = "";

    if (user.cpfEncrypted) {
      const decrypted = decryptCPF(user.cpfEncrypted);
      const numbers = decrypted.replace(/\D/g, "");
      cpfMasked = numbers.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2");
    }

    // ✅ RETORNO PADRÃO IGUAL
    return res.json({
      message: "Login bem-sucedido",
      token: tokenJWT,
      expiresIn: "2h",
      user: {
        hasPassword: !!user.password,
        name: user.name,
        email: user.email,
        affiliate: user.affiliate,
        addresses: user.addresses,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        cpfMasked,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Token inválido" });
  }
};

export const registerUserController = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    function generateCoupon(name) {
      // remove acentos
      const normalize = (str) =>
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const cleaned = normalize(name)
        .trim()
        .split(" ")
        .slice(0, 2) // pega no máximo 2 nomes
        .join("");

      const base = cleaned
        .replace(/[^a-zA-Z]/g, "") // só letras
        .toUpperCase()
        .slice(0, 10); // limita tamanho

      const random = Math.floor(1000 + Math.random() * 9000);

      return `${base}${random}`;
    }
    const normalizedEmail = email.toLowerCase().trim();
    const formattedName = formatName(name);
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }

    const encryptedPassword = bcrypt.hashSync(password, bcryptSalt);
    const couponCode = generateCoupon(name);

    const userDoc = await User.create({
      name: formattedName,
      email: normalizedEmail,
      password: encryptedPassword,
      affiliate: {
        couponCode,
      },
      role: "user",
      verified: false,
    });

    // ATIVAR QUANDO TIVER DOMINIO
    // 🔐 gerar token de verificação
    const verificationToken = await JWTSignEmailVerification(userDoc._id);

    // 📧 enviar email
    try {
      await sendVerificationEmail(normalizedEmail, verificationToken);
    } catch (emailError) {
      console.error("Erro ao enviar email:", emailError);
    }
    return res.status(201).json({
      message: "Conta criada!",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao registrar usuário" });
  }
};

//ok
export const getProfileController = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user._id).lean();

    if (!userDoc) {
      return res.status(404).json({
        error: "Usuário não encontrado",
      });
    }

    let cpfMasked = "";

    if (userDoc.cpfEncrypted) {
      const decrypted = decryptCPF(userDoc.cpfEncrypted);
      const numbers = decrypted.replace(/\D/g, "");
      cpfMasked = numbers.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2");
    }

    res.status(200).json({
      message: "Informações de perfil enviadas com sucesso",
      user: {
        hasPassword: !!userDoc.password,
        name: userDoc.name,
        email: userDoc.email,
        addresses: userDoc.addresses,
        phone: userDoc.phone,
        dateOfBirth: userDoc.dateOfBirth,
        cpfMasked,
        affiliate: userDoc.affiliate,
        role: userDoc.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
export const payAffiliateController = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user || !user.affiliate) {
      return res.status(404).json({ error: "Afiliado não encontrado" });
    }

    const amount = user.affiliate.pendingBalance || 0;

    if (amount <= 0) {
      return res.status(400).json({ error: "Nada a pagar" });
    }

    user.affiliate.totalPaid += amount;
    user.affiliate.pendingBalance = 0;

    await user.save();

    res.json({
      message: "Pagamento registrado com sucesso",
      paid: amount,
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao pagar afiliado" });
  }
};
export const updateAffiliateController = async (req, res) => {
  try {
    const { userId } = req.params;
    const { couponCode, discountPercentage, commissionPercentage } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // evita duplicar cupom
    if (couponCode) {
      const exists = await User.findOne({
        "affiliate.couponCode": couponCode.toUpperCase(),
        _id: { $ne: userId },
      });

      if (exists) {
        return res.status(400).json({ error: "Cupom já existe" });
      }

      user.affiliate.couponCode = couponCode.toUpperCase();
    }

    if (discountPercentage !== undefined) {
      user.affiliate.discountPercentage = Number(discountPercentage);
    }

    if (commissionPercentage !== undefined) {
      user.affiliate.commissionPercentage = Number(commissionPercentage);
    }

    await user.save();

    res.json({
      message: "Afiliado atualizado",
      affiliate: user.affiliate,
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar afiliado" });
  }
};
//ok
export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: "E-mail/senha incorreta" });
    }

    const passwordCorrect = bcrypt.compareSync(password, user.password);
    if (!passwordCorrect) {
      return res.status(401).json({ error: "E-mail/senha incorreta" });
    }

    // 🔴 Bloqueia se não verificado
    if (!user.verified) {
      return res.status(401).json({
        error: "Verifique seu email antes de acessar sua conta.",
      });
    }

    const token = await JWTSign({
      _id: user._id,
      name: user.name,
      role: user.role,
    });

    let cpfMasked = "";

    if (user.cpfEncrypted) {
      const decrypted = decryptCPF(user.cpfEncrypted);
      const numbers = decrypted.replace(/\D/g, "");
      cpfMasked = numbers.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2");
    }

    return res.json({
      message: "Login bem-sucedido",
      token, // 👈 envie o token
      expiresIn: "2h",
      user: {
        hasPassword: !!user.password,
        name: user.name,
        email: user.email,
        affiliate: user.affiliate,
        addresses: user.addresses,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        cpfMasked,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};
export const validateCouponController = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Cupom não informado" });
    }

    const couponCode = code.trim().toUpperCase();

    const user = await User.findById(req.user._id);

    // 🔴 VERIFICA SE JÁ USOU
    const alreadyUsed = user.usedCoupons?.some((c) => c.code === couponCode);

    if (alreadyUsed) {
      return res.status(400).json({
        error: "Você já utilizou este cupom",
      });
    }

    const affiliateUser = await User.findOne({
      "affiliate.couponCode": couponCode,
    });

    if (!affiliateUser) {
      return res.status(404).json({ error: "Cupom inválido" });
    }

    // 🔴 BLOQUEIA USAR PRÓPRIO CUPOM
    if (affiliateUser._id.equals(req.user._id)) {
      return res.status(400).json({
        error: "Você não pode usar seu próprio cupom",
      });
    }

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
export const getUsersController = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password -cpfEncrypted -__v")
      .lean();

    res.status(200).json({
      message: "Informações dos usuários enviadas com sucesso",
      users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const changePasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const hadPassword = !!user.password;

    /* =========================
       VALIDA NOVA SENHA
    ========================== */
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: "A nova senha deve ter pelo menos 6 caracteres",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        error: "As novas senhas não coincidem",
      });
    }

    /* =========================
       SE JÁ TINHA SENHA
    ========================== */
    if (hadPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          error: "Informe a senha atual",
        });
      }

      const passwordCorrect = bcrypt.compareSync(
        currentPassword,
        user.password,
      );

      if (!passwordCorrect) {
        return res.status(401).json({
          error: "Senha atual incorreta",
        });
      }
    }

    /* =========================
       SALVAR NOVA SENHA
    ========================== */
    const encryptedNewPassword = bcrypt.hashSync(newPassword, bcryptSalt);
    user.password = encryptedNewPassword;

    await user.save();

    return res.json({
      message: hadPassword
        ? "Senha alterada com sucesso"
        : "Senha criada com sucesso",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const updateUserController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { id } = req.params;
    const { role } = req.body;

    const userToUpdate = await User.findById(id);

    if (!userToUpdate) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    userToUpdate.role = role;
    await userToUpdate.save();

    res.status(200).json({
      message: "Usuário atualizado com sucesso",
      user: userToUpdate,
    });
  } catch (err) {
    console.error("ERRO UPDATE USER:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const deleteUserController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const { id } = req.params;

    if (id === req.user._id) {
      return res.status(400).json({
        error: "Você não pode deletar sua própria conta.",
      });
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    res.status(200).json({
      message: "Usuário deletado com sucesso.",
      user: deletedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
export const updateMyProfileController = async (req, res) => {
  try {
    const { name, email, phone, cpf, dateOfBirth } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    /* =========================
       VERIFICA DUPLICIDADE EMAIL
    ========================== */
    if (email && email !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail)
        return res.status(400).json({ error: "E-mail já em uso" });
    }

    /* =========================
       VERIFICA DUPLICIDADE CPF
       (comparando descriptografado)
    ========================== */
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, "");

      const usersWithCpf = await User.find({
        _id: { $ne: user._id },
        cpfEncrypted: { $exists: true },
      });

      for (const u of usersWithCpf) {
        const decrypted = decryptCPF(u.cpfEncrypted);
        if (decrypted === cleanCpf) {
          return res.status(400).json({ error: "CPF já cadastrado" });
        }
      }

      user.cpfEncrypted = encryptCPF(cleanCpf);
    }

    /* =========================
       ATUALIZA CAMPOS
    ========================== */
    user.name = name ? formatName(name) : user.name;
    user.email = email ? email.toLowerCase().trim() : user.email;
    user.phone = phone ?? user.phone;
    user.dateOfBirth = dateOfBirth ?? user.dateOfBirth;

    await user.save();

    /* =========================
       PREPARA RETORNO
    ========================== */
    let cpfDecrypted = "";
    let cpfMasked = "";

    if (user.cpfEncrypted) {
      cpfDecrypted = decryptCPF(user.cpfEncrypted);

      cpfMasked = cpfDecrypted.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2");
    }

    res.json({
      message: "Perfil atualizado com sucesso",
      user: {
        hasPassword: !!user.password,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        cpf: cpfDecrypted,
        cpfMasked,
        verified: user.verified,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
};

export const verifyEmailController = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(`${frontend}/verified-error`);
    }

    const decoded = await JWTVerifyEmailToken(token);

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.redirect(`${frontend}/verified-error`);
    }

    if (user.verified) {
      return res.redirect(`${frontend}/verified-success`);
    }

    user.verified = true;
    await user.save();

    return res.redirect(`${frontend}/verified-success`);
  } catch (err) {
    console.error(err);
    return res.redirect(`${frontend}/verified-error`);
  }
};

export const resendVerificationController = async (req, res) => {
  try {
    const { email } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (user.verified) {
      return res.status(400).json({ error: "Conta já verificada" });
    }

    // limite de 60s entre envios
    if (
      user.lastVerificationEmail &&
      Date.now() - user.lastVerificationEmail < 60000
    ) {
      return res.status(429).json({
        error: "Aguarde 1 minuto antes de solicitar novamente.",
      });
    }

    const token = await JWTSignEmailVerification(user._id);

    await sendVerificationEmail(normalizedEmail, token);

    user.lastVerificationEmail = Date.now();
    await user.save();

    return res.json({ message: "Email reenviado com sucesso" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao reenviar email" });
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.json({
        message: "Se o email existir, enviaremos instruções.",
      });
    }

    const token = JWTSignPasswordReset(user._id);

    await sendPasswordResetEmail(normalizedEmail, token);

    res.json({
      message: "Email de recuperação enviado",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao solicitar redefinição" });
  }
};

export const resetPasswordController = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = JWTVerifyPasswordReset(token);

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const encryptedPassword = bcrypt.hashSync(newPassword, bcryptSalt);

    user.password = encryptedPassword;

    await user.save();

    res.json({
      message: "Senha redefinida com sucesso",
    });
  } catch (err) {
    res.status(400).json({
      error: "Token inválido ou expirado",
    });
  }
};
