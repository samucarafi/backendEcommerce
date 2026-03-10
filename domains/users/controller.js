import User from "./model.js";
import bcrypt from "bcryptjs";
import "dotenv/config.js";
import { JWTSign } from "../../utils/jwt.js";
import {
  JWTSignEmailVerification,
  JWTVerifyEmailToken,
} from "../../utils/jwt.js";
import { sendVerificationEmail } from "../../services/emailService.js";
import { decryptCPF, encryptCPF } from "../../utils/cpfCrypto.js";

//create a hash for bcrypt
const bcryptSalt = bcrypt.genSaltSync();

export const registerUserController = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }

    const encryptedPassword = bcrypt.hashSync(password, bcryptSalt);

    const userDoc = await User.create({
      name,
      email,
      password: encryptedPassword,
      role: "user",
      verified: false,
    });

    // ATIVAR QUANDO TIVER DOMINIO
    // 🔐 gerar token de verificação
    const verificationToken = await JWTSignEmailVerification(userDoc._id);

    // 📧 enviar email
    try {
      await sendVerificationEmail(email, verificationToken);
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
        name: userDoc.name,
        email: userDoc.email,
        addresses: userDoc.addresses,
        phone: userDoc.phone,
        dateOfBirth: userDoc.dateOfBirth,
        cpfMasked,
        role: userDoc.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

//ok
export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
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
        name: user.name,
        email: user.email,
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
    const passwordCorrect = bcrypt.compareSync(currentPassword, user.password);
    if (!passwordCorrect) {
      return res.status(401).json({ error: "Senha atual incorreta" });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: "As novas senhas não coincidem" });
    }
    const encryptedNewPassword = bcrypt.hashSync(newPassword, bcryptSalt);
    user.password = encryptedNewPassword;
    await user.save();
    res.json({ message: "Senha alterada com sucesso" });
  } catch (err) {
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
      const existingEmail = await User.findOne({ email });
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
    user.name = name ?? user.name;
    user.email = email ?? user.email;
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
      return res.redirect(`${process.env.FRONTEND_URL}/verified-error`);
    }

    const decoded = await JWTVerifyEmailToken(token);

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/verified-error`);
    }

    if (user.verified) {
      return res.redirect(`${process.env.FRONTEND_URL}/verified-success`);
    }

    user.verified = true;
    await user.save();

    return res.redirect(`${process.env.FRONTEND_URL}/verified-success`);
  } catch (err) {
    console.error(err);
    return res.redirect(`${process.env.FRONTEND_URL}/verified-error`);
  }
};

export const resendVerificationController = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

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

    await sendVerificationEmail(email, token);

    user.lastVerificationEmail = Date.now();
    await user.save();

    return res.json({ message: "Email reenviado com sucesso" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao reenviar email" });
  }
};
