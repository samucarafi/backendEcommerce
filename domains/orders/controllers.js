import Order from "./model.js";
import Product from "../products/model.js";
import { Preference, Payment } from "mercadopago";
import { v4 as uuidv4 } from "uuid";
import { mpClient as client } from "../../config/mercadopago.js";
import User from "../users/model.js";
import { encryptCPF } from "../../utils/cpfCrypto.js";
import { decryptCPF } from "../../utils/cpfCrypto.js";

function maskCPF(cpf) {
  if (!cpf) return null;

  const numbers = cpf.replace(/\D/g, "");
  return numbers.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2");
}

function getFrontendUrl() {
  const raw = process.env.FRONTEND_URL || "";

  // separa por vírgula e pega a primeira
  const firstUrl = raw.split(",")[0].trim();

  // garante que termina sem /
  return firstUrl.replace(/\/$/, "");
}

const frontend = getFrontendUrl();
export const getPaymentLink = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    if (!order.payment?.mpPreferenceId)
      return res.status(400).json({ error: "Pedido não possui preference" });

    // busca a preference existente no MP
    const preference = new Preference(client);

    const mpRes = await preference.get({
      preferenceId: order.payment.mpPreferenceId,
    });

    return res.json({
      init_point: mpRes.init_point,
    });
  } catch (err) {
    console.error("GET PAYMENT LINK ERROR:", err);
    res.status(500).json({ error: "Erro ao buscar link de pagamento" });
  }
};

export const createCheckoutController = async (req, res) => {
  try {
    const { items, customer, shippingAddress, shipping } = req.body;
    const user = await User.findById(req.user._id);
    let cpfToUse = "";

    if (!customer?.cpf) {
      return res.status(400).json({ error: "CPF obrigatório" });
    }
    if (customer.cpf === "USE_SAVED_CPF") {
      if (!user.cpfEncrypted) {
        return res.status(400).json({ error: "CPF não cadastrado" });
      }

      cpfToUse = decryptCPF(user.cpfEncrypted);
    } else {
      const cleanCpf = customer.cpf.replace(/\D/g, "");

      if (!cpfUtils.isValid(cleanCpf)) {
        return res.status(400).json({ error: "CPF inválido" });
      }

      cpfToUse = cleanCpf;

      if (!user.cpfEncrypted) {
        user.cpfEncrypted = encryptCPF(cleanCpf);
      }
    }

    // salvar endereço se ainda não existir
    const alreadyExists = user.addresses.some(
      (addr) =>
        addr.cep === shippingAddress.cep &&
        addr.number === shippingAddress.number,
    );

    if (!alreadyExists) {
      user.addresses.push(shippingAddress);
    }

    await user.save();

    const validatedItems = [];

    for (const item of items) {
      // ignorar descontos e frete
      if (item.type && item.type !== "product") {
        validatedItems.push(item);
        continue;
      }

      const product = await Product.findById(item.productId);

      if (!product) {
        console.error("Produto não encontrado:", item.productId);
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      if (product.stock < item.quantity)
        return res.status(400).json({ error: "Estoque insuficiente" });

      validatedItems.push({
        productId: product._id,
        title: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        type: "product",
      });
    }

    const orderId = uuidv4();

    const itemsTotal = validatedItems.reduce(
      (s, i) => s + i.unit_price * i.quantity,
      0,
    );
    const itemsMp = validatedItems.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      currency_id: "BRL",
      unit_price: i.unit_price,
    }));

    if (shipping > 0) {
      itemsMp.push({
        title: "Frete",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(shipping),
      });
    }
    const total = itemsTotal + shipping;

    const preference = new Preference(client);

    const mpRes = await preference.create({
      body: {
        items: itemsMp,
        external_reference: orderId,

        payer: {
          name: customer.name,
          email: customer.email,
          identification: {
            type: "CPF",
            number: cpfToUse,
          },
        },

        back_urls: {
          success: frontend + "/success",
          failure: frontend + "/failure",
          pending: frontend + "/pending",
        },

        notification_url: process.env.BACKEND_URL + "/payment/webhook",

        auto_return: "approved",
      },
    });

    await Order.create({
      orderId,
      userId: req.user?._id,
      customer,
      items: validatedItems,
      totals: {
        items: itemsTotal,
        shipping,
        total,
      },
      shippingAddress,
      payment: {
        method: "mercadopago",
        status: "pending",
        mpPreferenceId: mpRes.id,
      },
    });

    res.json({ init_point: mpRes.init_point });
  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(500).json({ error: "Erro ao criar checkout" });
  }
};

export const webhookController = async (req, res) => {
  try {
    console.log("WEBHOOK RECEIVED:", req.body);

    if (req.body?.type !== "payment") {
      return res.sendStatus(200);
    }

    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    let payment;

    try {
      const paymentClient = new Payment(client);
      payment = await paymentClient.get({ id: paymentId });
    } catch (err) {
      // se pagamento não existe (ex: teste)
      if (err.status === 404) {
        console.log("Pagamento não encontrado (teste ou ainda não criado)");
        return res.sendStatus(200);
      }
      throw err;
    }

    if (!payment) return res.sendStatus(200);

    const orderId = payment.external_reference;
    if (!orderId) return res.sendStatus(200);

    const order = await Order.findOne({ orderId });
    if (!order) return res.sendStatus(200);

    const status = payment.status || "unknown";

    // baixa estoque apenas 1x
    if (status === "approved" && order.payment.status !== "approved") {
      for (const item of order.items) {
        if (item.type !== "product") continue;

        await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
        );
      }
    }

    order.payment.status = status;
    order.payment.mpPaymentId = paymentId;

    await order.save();

    res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.sendStatus(200);
  }
};

export const createOrder = async (req, res) => {
  try {
    const { items, totals, address, customer, preferenceId } = req.body;

    const validatedItems = [];

    for (const item of items) {
      if (item.type && item.type !== "product") {
        validatedItems.push(item);
        continue;
      }

      const product = await Product.findById(item.productId);

      if (!product)
        return res.status(404).json({ error: "Produto não encontrado" });

      if (product.stock < item.quantity)
        return res.status(400).json({ error: "Estoque insuficiente" });

      validatedItems.push({
        productId: product._id,
        title: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        type: "product",
      });
    }

    const order = await Order.create({
      orderId: "ORD-" + Date.now(),
      userId: req.user?._id,
      customer,
      items: validatedItems,

      totals,
      shippingAddress: address,
      payment: {
        method: "pix",
        mpPreferenceId: preferenceId,
      },
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.user._id,
    })
      .populate("userId", "name email cpfEncrypted")
      .populate("items.productId", "stock name")
      .lean();

    const ordersFormatted = orders.map((order) => {
      let cpfMasked = null;

      if (order.userId?.cpfEncrypted) {
        const decrypted = decryptCPF(order.userId.cpfEncrypted);
        cpfMasked = maskCPF(decrypted);
      }

      return {
        ...order,
        userId: order.userId
          ? {
              _id: order.userId._id,
              name: order.userId.name,
              email: order.userId.email,
              cpf: cpfMasked, // 👈 apenas mascarado
            }
          : null,
      };
    });

    res.json(ordersFormatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar pedidos" });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId")
      .sort({ createdAt: -1 })
      .lean();

    const isAdmin = req.user?.role === "admin";

    const formatted = orders.map((order) => {
      let cpf = null;

      if (order.userId?.cpfEncrypted) {
        cpf = decryptCPF(order.userId.cpfEncrypted);
      }

      return {
        ...order,
        userId: order.userId
          ? {
              ...order.userId,
              cpf: isAdmin ? cpf : undefined, // 🔐 só admin recebe
              cpfEncrypted: undefined,
              password: undefined,
            }
          : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar pedidos" });
  }
};

export const updateDeliveryStatus = async (req, res) => {
  const { status } = req.body;

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { deliveryStatus: status },
    { new: true },
  );

  res.json(order);
};
