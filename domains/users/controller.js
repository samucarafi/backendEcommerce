import User from "./model.js";
import bcrypt from "bcryptjs";
import "dotenv/config.js";
import { JWTSign, JWTVerify } from "../../utils/jwt.js";

//create a hash for bcrypt
const bcryptSalt = bcrypt.genSaltSync();

export const registerUserController = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }
    const user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }
    const encryptedPassword = bcrypt.hashSync(password, bcryptSalt);

    const userDoc = await User.create({
      name,
      email,
      password: encryptedPassword,
      role: "user",
    });
    const { _id, role } = userDoc;
    const token = await JWTSign({ _id, name });
    res.cookie("token", token).json({
      message: "Conta criada com sucesso! Faça login para continuar.",
      user: {
        name,
        email,
        role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar usuário" + err });
  }
};

export const logoutController = (req, res) => {
  res.clearCookie("token").json({ message: "Deslogado com sucesso" });
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
      return res.status(404).json({ error: "E-mail não cadastrado" });
    }
    const passwordCorrect = bcrypt.compareSync(password, user.password);
    const { _id, name, role } = user;
    if (!passwordCorrect) {
      return res.status(401).json({ error: "Senha incorreta" });
    }
    // const maskedCpf = cpf
    //   ? cpf.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2")
    //   : "";
    // Create a token
    const token = await JWTSign({ _id, name });
    res.cookie("token", token).json({
      message: "Login bem-sucedido",
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
