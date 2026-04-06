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
    const { items, customer, shippingAddress, shipping, coupon } = req.body;
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
      cpfToUse = cleanCpf;

      if (!user.cpfEncrypted) {
        user.cpfEncrypted = encryptCPF(cleanCpf);
      }
    }

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
      if (item.type && item.type !== "product") continue;

      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ error: "Estoque insuficiente" });
      }

      validatedItems.push({
        productId: product._id,
        title: product.name,
        quantity: Number(item.quantity),
        unit_price: Number(product.price),
        type: "product",
      });
    }

    const orderId = uuidv4();

    const itemsTotal = validatedItems.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );

    let finalShipping = Number(shipping) || 0;
    let itemsDiscount = 0;
    let shippingDiscount = 0;
    let affiliateData = null;

    // Cupom pode vir como objeto ou string
    const couponCode =
      typeof coupon === "string"
        ? coupon.trim().toUpperCase()
        : coupon?.code?.trim()?.toUpperCase() || null;
    if (couponCode) {
      const alreadyUsed = user.usedCoupons?.some((c) => c.code === couponCode);

      if (alreadyUsed) {
        return res.status(400).json({
          error: "Você já utilizou este cupom",
        });
      }
    }

    // =========================
    // CUPOM DE AFILIADO
    // =========================
    if (couponCode) {
      const affiliateUser = await User.findOne({
        "affiliate.couponCode": couponCode,
      });
      if (couponCode) {
        const affiliateUser = await User.findOne({
          "affiliate.couponCode": couponCode,
        });

        // 🚫 impedir usar próprio cupom
        if (affiliateUser && affiliateUser._id.equals(req.user._id)) {
          return res.status(400).json({
            error: "Você não pode usar seu próprio cupom",
          });
        }
      }
      if (affiliateUser) {
        const percentage = Number(
          affiliateUser.affiliate.discountPercentage || 0,
        );

        if (percentage > 0) {
          itemsDiscount = Number(((itemsTotal * percentage) / 100).toFixed(2));
        }

        affiliateData = {
          userId: affiliateUser._id,
          couponCode,
          discountGiven: itemsDiscount,
          commissionPercentage: affiliateUser.affiliate.commissionPercentage,
          commissionValue: Number(
            (
              (itemsTotal * affiliateUser.affiliate.commissionPercentage) /
              100
            ).toFixed(2),
          ),
          status: "pending",
        };
      }
    }

    // =========================
    // CUPOM NORMAL
    // =========================
    if (!affiliateData && coupon && typeof coupon === "object") {
      if (coupon.type === "percentage") {
        itemsDiscount = Number(
          ((itemsTotal * Number(coupon.value || 0)) / 100).toFixed(2),
        );
      }

      if (coupon.type === "fixed") {
        itemsDiscount = Math.min(Number(coupon.value || 0), itemsTotal);
        itemsDiscount = Number(itemsDiscount.toFixed(2));
      }

      if (coupon.type === "shipping") {
        shippingDiscount = Math.min(Number(coupon.value || 0), finalShipping);
        shippingDiscount = Number(shippingDiscount.toFixed(2));
        finalShipping = Number((finalShipping - shippingDiscount).toFixed(2));
      }
    }

    // garante limites
    itemsDiscount = Math.min(itemsDiscount, itemsTotal);
    itemsDiscount = Number(itemsDiscount.toFixed(2));

    // =========================
    // DISTRIBUI DESCONTO NOS ITENS
    // =========================
    let itemsMp = [];

    if (itemsTotal > 0) {
      let remainingDiscount = itemsDiscount;

      itemsMp = validatedItems.map((item, index) => {
        const itemSubtotal = item.unit_price * item.quantity;

        let itemDiscount = 0;

        if (itemsDiscount > 0) {
          if (index === validatedItems.length - 1) {
            itemDiscount = remainingDiscount;
          } else {
            itemDiscount = Number(
              ((itemSubtotal / itemsTotal) * itemsDiscount).toFixed(2),
            );
            remainingDiscount = Number(
              (remainingDiscount - itemDiscount).toFixed(2),
            );
          }
        }

        const finalSubtotal = Math.max(0, itemSubtotal - itemDiscount);
        const finalUnitPrice = Number(
          (finalSubtotal / item.quantity).toFixed(2),
        );

        return {
          title: item.title,
          quantity: item.quantity,
          currency_id: "BRL",
          unit_price: finalUnitPrice,
        };
      });
    }

    if (finalShipping > 0) {
      itemsMp.push({
        title: "Frete",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(finalShipping.toFixed(2)),
      });
    }

    const total = Number(
      (itemsTotal + finalShipping - itemsDiscount).toFixed(2),
    );

    const paymentClient = new Payment(client);

    const payment = await paymentClient.create({
      body: {
        transaction_amount: total,
        description: "Compra Royal Parfums",

        payment_method_id: "pix",

        external_reference: orderId,

        payer: {
          email: customer.email,
          first_name: customer.name,
          identification: {
            type: "CPF",
            number: cpfToUse,
          },
        },

        notification_url: process.env.BACKEND_URL + "/payment/webhook",
      },
    });
    const pixData = payment.point_of_interaction.transaction_data;

    await Order.create({
      orderId,
      userId: req.user?._id,
      customer,
      affiliate: affiliateData,
      items: validatedItems,
      coupon: couponCode
        ? {
            code: couponCode,
            type: affiliateData ? "affiliate" : coupon?.type || null,
            value: affiliateData
              ? affiliateData.discountGiven
              : Number(coupon?.value || 0),
            applied: !!(itemsDiscount > 0 || shippingDiscount > 0),
          }
        : {
            code: null,
            type: null,
            value: 0,
            applied: false,
          },
      totals: {
        items: Number(itemsTotal.toFixed(2)),
        subtotal: Number(itemsTotal.toFixed(2)),
        discount: Number(itemsDiscount.toFixed(2)),
        originalShipping: Number((Number(shipping) || 0).toFixed(2)),
        shippingDiscount: Number(shippingDiscount.toFixed(2)),
        shipping: Number(finalShipping.toFixed(2)),
        total,
      },
      shippingAddress,
      payment: {
        method: "mercadopago",
        status: "pending",
        mpPaymentId: payment.id,
        pix: {
          qr_code: pixData.qr_code,
          qr_code_base64: pixData.qr_code_base64,
          ticket_url: pixData.ticket_url,
        },
      },
    });

    res.json({
      orderId,
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      ticket_url: pixData.ticket_url,
    });
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
      if (order.coupon?.code && order.userId) {
        await User.findByIdAndUpdate(order.userId, {
          $addToSet: {
            usedCoupons: {
              code: order.coupon.code,
              usedAt: new Date(),
            },
          },
        });
      }
      // baixa estoque
      for (const item of order.items) {
        if (item.type !== "product") continue;

        await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
        );
      }

      // =============================
      // COMISSÃO DE AFILIADO
      // =============================
      if (order.affiliate?.userId && order.affiliate.status === "pending") {
        const affiliateUser = await User.findById(order.affiliate.userId);

        if (affiliateUser) {
          affiliateUser.affiliate.pendingBalance +=
            order.affiliate.commissionValue;

          await affiliateUser.save();

          order.affiliate.status = "approved";

          console.log("Comissão aprovada para afiliado:", affiliateUser.email);
        }
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

export const payOrderController = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    if (order.payment.status === "approved") {
      return res.status(400).json({ error: "Pedido já pago" });
    }

    const total = order.totals.total;

    const paymentClient = new Payment(client);

    const payment = await paymentClient.create({
      body: {
        transaction_amount: total,
        description: "Pagamento de pedido existente",
        payment_method_id: "pix",
        external_reference: order.orderId,
        payer: {
          email: order.customer.email,
          first_name: order.customer.name,
          identification: {
            type: "CPF",
            number: order.customer.cpf,
          },
        },
        notification_url: process.env.BACKEND_URL + "/payment/webhook",
      },
    });

    const pixData = payment.point_of_interaction.transaction_data;

    order.payment.mpPaymentId = payment.id;
    order.payment.status = "pending";
    order.payment.pix = {
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      ticket_url: pixData.ticket_url,
    };
    await order.save();

    res.json({
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      ticket_url: pixData.ticket_url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar pagamento" });
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
