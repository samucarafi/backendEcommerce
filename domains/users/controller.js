import User from "./model.js";
import bcrypt from "bcryptjs";
import "dotenv/config.js";
import { JWTSign } from "../../utils/jwt.js";
import {
  JWTSignEmailVerification,
  JWTVerifyEmailToken,
} from "../../utils/jwt.js";
import { sendVerificationEmail } from "../../services/emailService.js";

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

    // 🔐 gerar token de verificação
    const verificationToken = await JWTSignEmailVerification(userDoc._id);

    // 📧 enviar email
    await sendVerificationEmail(email, verificationToken);

    return res.status(201).json({
      message: "Conta criada! Verifique seu email para ativar.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao registrar usuário" });
  }
};

export const logoutController = (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
    })
    .json({ message: "Deslogado com sucesso" });
};
//ok
export const getProfileController = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user._id);
    if (!userDoc) {
      return res.status(404).json({
        error: "Usuário não encontrado",
      });
    }
    const { name, email, role } = userDoc;
    // const maskedCpf = cpf
    //   ? cpf.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2")
    //   : "";

    res.status(200).json({
      message: "Informações de perfil enviadas com sucesso",
      user: {
        name,
        email,
        role,
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

    return res
      .cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      })
      .json({
        message: "Login bem-sucedido",
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const getUsersController = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user._id);
    if (!userDoc) {
      return res.status(404).json({
        error: "Usuário não encontrado",
      });
    }
    if (userDoc.role !== "admin") {
      return res.status(401).json({
        error: "Usuário não é administrador",
      });
    }
    const users = await User.find();

    res.status(200).json({
      message: "Informações dos usuários enviadas com sucesso",
      users,
    });
  } catch (err) {
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
    const { id } = req.params;
    id = "1k2j12n2j1nr21k";
    const updatedUser = await User.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, error: "Usuário não encontrado" });
    }

    const { name, email, role } = updatedUser;

    res.json({
      success: true,
      user: { _id: id, role, name, email },
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: "Erro interno no servidor" + err });
  }
};

export const verifyEmailController = async (req, res) => {
  try {
    const { token } = req.query;

    const decoded = await JWTVerifyEmailToken(token);

    await User.findByIdAndUpdate(decoded.userId, {
      verified: true,
    });

    return res.redirect(`${process.env.FRONTEND_URL}/verified-success`);
  } catch (err) {
    console.error("Erro caiu no catch:", err);
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

    const token = await JWTSignEmailVerification(user._id);

    await sendVerificationEmail(email, token);

    return res.json({ message: "Email reenviado com sucesso" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao reenviar email" });
  }
};
