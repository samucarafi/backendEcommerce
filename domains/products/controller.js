import Product from "./model.js";
import "dotenv/config.js";

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
