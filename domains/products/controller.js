import Product from "./model.js";
import bcrypt from "bcryptjs";
import "dotenv/config.js";
import { JWTSign, JWTVerify } from "../../utils/jwt.js";

//create a hash for bcrypt
const bcryptSalt = bcrypt.genSaltSync();

export const createProductsController = async (req, res) => {
  try {
    const {
      name,
      price,
      description,
      image,
      stock,
      category,
      weight,
      popularity,
    } = req.body;

    // if (!email || !password) {
    //   return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    // }
    // const user = await User.findOne({ email });
    // if (user) {
    //   return res.status(409).json({ error: "E-mail já cadastrado" });
    // }
    const newProduct = await Product.create({
      name,
      price,
      description,
      image,
      stock,
      category,
      weight,
      popularity,
    });
    res.json({
      message: "Produto criado com sucesso!",
      newProduct: newProduct,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar produto" });
  }
};

export const logoutController = (req, res) => {
  res.clearCookie("token").json({ message: "Deslogado com sucesso" });
};

export const getProductsController = async (req, res) => {
  try {
    const productsDoc = await Product.find();
    if (!productsDoc) {
      return res.status(404).json({
        error: "Produtos não encontrados",
      });
    }
    res.status(200).json({
      message: "Informações de perfil enviadas com sucesso",
      products: productsDoc,
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

export const getUsers = async (req, res) => {
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

export const updateProductController = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, image, stock, category, weight } =
      req.body;

    // return;
    // const updateData = {};
    // if (name) updateData.name = name;
    // if (email) updateData.email = email;
    // if (phone) updateData.phone = phone;

    // if (cpf) updateData.cpf = cpf;
    // if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updatedProduct) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    res.json({
      message: "Alterações no produto salvas",
      product: updatedProduct,
    });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const deleteProductController = async (req, res) => {
  try {
    const { id } = req.params;

    const deleteProduct = await Product.findByIdAndDelete(id);

    if (!deleteProduct) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    res.json({
      message: "Produto excluído!",
    });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
