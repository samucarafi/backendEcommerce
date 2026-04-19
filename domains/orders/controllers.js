/**
 * modules/orders/controller.js
 *
 * Regras de negócio de cupom:
 *  - "PRIMEIRACOMPRA" → uso único por CPF (verificado via cpfHash)
 *  - Cupons de afiliado → sem restrição de reutilização por CPF;
 *    apenas o próprio dono do cupom não pode usá-lo.
 */

import Order from "./model.js";
import Product from "../products/model.js";
import User from "../users/model.js";
import { Preference, Payment } from "mercadopago";
import { v4 as uuidv4 } from "uuid";
import { mpClient as client } from "../../config/mercadopago.js";
import {
  encryptCPF,
  decryptCPF,
  hashCPF,
  maskCPF,
} from "../../utils/cpfCrypto.js";

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */

const FIRST_PURCHASE_COUPON = "PRIMEIRACOMPRA";

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
}

/**
 * Resolve o CPF real a partir do body + usuário salvo no DB.
 * Retorna { cpfRaw, cpfHash } ou lança erro com mensagem.
 */
async function resolveCpf(customerCpf, user) {
  if (!customerCpf) {
    throw { status: 400, message: "CPF obrigatório" };
  }

  if (customerCpf === "USE_SAVED_CPF") {
    if (!user.cpfEncrypted) {
      throw { status: 400, message: "CPF não cadastrado. Informe o CPF." };
    }
    const raw = decryptCPF(user.cpfEncrypted);
    return { cpfRaw: raw, cpfHash: hashCPF(raw) };
  }

  const raw = customerCpf.replace(/\D/g, "");
  return { cpfRaw: raw, cpfHash: hashCPF(raw) };
}

/**
 * Persiste cpfEncrypted e cpfHash no usuário, se ainda não existirem.
 */
async function saveCpfToUser(user, cpfRaw) {
  if (!user.cpfEncrypted) {
    user.cpfEncrypted = encryptCPF(cpfRaw);
    user.cpfHash = hashCPF(cpfRaw);
  }
}

/**
 * Salva endereço se ainda não existir.
 */
function maybeSaveAddress(user, shippingAddress) {
  const exists = user.addresses.some(
    (a) => a.cep === shippingAddress.cep && a.number === shippingAddress.number,
  );
  if (!exists) user.addresses.push(shippingAddress);
}

/* ─────────────────────────────────────────────────────────
   Validação de cupom
───────────────────────────────────────────────────────── */

/**
 * Valida e calcula descontos do cupom.
 *
 * Retorna:
 *  {
 *    itemsDiscount,
 *    shippingDiscount,
 *    finalShipping,
 *    affiliateData,       // null se não for afiliado
 *    couponMeta,          // objeto para salvar no pedido
 *  }
 */
async function processCoupon({
  couponInput, // valor enviado no body (string ou objeto)
  userId,
  cpfHash,
  itemsTotal,
  originalShipping,
}) {
  // Normaliza para string ou null
  const couponCode =
    typeof couponInput === "string"
      ? couponInput.trim().toUpperCase()
      : (couponInput?.code?.trim?.()?.toUpperCase?.() ?? null);

  let itemsDiscount = 0;
  let shippingDiscount = 0;
  let finalShipping = originalShipping;
  let affiliateData = null;
  let couponMeta = {
    code: null,
    type: null,
    value: 0,
    applied: false,
    cpfHash: null,
  };

  if (!couponCode)
    return {
      itemsDiscount,
      shippingDiscount,
      finalShipping,
      affiliateData,
      couponMeta,
    };

  // ── PRIMEIRACOMPRA ──────────────────────────────────────
  if (couponCode === FIRST_PURCHASE_COUPON) {
    // Verifica se CPF já usou esse cupom (em qualquer conta)
    const cpfAlreadyUsed = await Order.findOne({
      "coupon.code": FIRST_PURCHASE_COUPON,
      "coupon.cpfHash": cpfHash,
      "payment.status": "approved",
    }).lean();

    if (cpfAlreadyUsed) {
      throw {
        status: 400,
        message: "O cupom PRIMEIRACOMPRA já foi utilizado com este CPF.",
      };
    }

    // Desconto fixo de 10% (ajuste conforme sua regra)
    const pct = 10;
    itemsDiscount = Number(((itemsTotal * pct) / 100).toFixed(2));

    couponMeta = {
      code: FIRST_PURCHASE_COUPON,
      type: "percentage",
      value: pct,
      applied: true,
      cpfHash,
    };

    return {
      itemsDiscount,
      shippingDiscount,
      finalShipping,
      affiliateData,
      couponMeta,
    };
  }

  // ── CUPOM DE AFILIADO ───────────────────────────────────
  const affiliateUser = await User.findOne({
    "affiliate.couponCode": couponCode,
  });

  if (affiliateUser) {
    // Dono não pode usar próprio cupom
    if (affiliateUser._id.equals(userId)) {
      throw {
        status: 400,
        message: "Você não pode usar seu próprio cupom de afiliado.",
      };
    }

    const pct = Number(affiliateUser.affiliate.discountPercentage || 0);
    if (pct > 0) {
      itemsDiscount = Number(((itemsTotal * pct) / 100).toFixed(2));
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

    couponMeta = {
      code: couponCode,
      type: "affiliate",
      value: itemsDiscount,
      applied: true,
      cpfHash: null, // afiliado não bloqueia por CPF
    };

    return {
      itemsDiscount,
      shippingDiscount,
      finalShipping,
      affiliateData,
      couponMeta,
    };
  }

  // ── CUPOM NORMAL (percentage / fixed / shipping) ────────
  if (couponInput && typeof couponInput === "object") {
    const { type, value } = couponInput;

    if (type === "percentage") {
      itemsDiscount = Number(
        ((itemsTotal * Number(value || 0)) / 100).toFixed(2),
      );
    }
    if (type === "fixed") {
      itemsDiscount = Number(
        Math.min(Number(value || 0), itemsTotal).toFixed(2),
      );
    }
    if (type === "shipping") {
      shippingDiscount = Number(
        Math.min(Number(value || 0), finalShipping).toFixed(2),
      );
      finalShipping = Number((finalShipping - shippingDiscount).toFixed(2));
    }

    couponMeta = {
      code: couponCode,
      type,
      value: Number(value || 0),
      applied: itemsDiscount > 0 || shippingDiscount > 0,
      cpfHash: null,
    };
  }

  return {
    itemsDiscount,
    shippingDiscount,
    finalShipping,
    affiliateData,
    couponMeta,
  };
}

/* ─────────────────────────────────────────────────────────
   Distribui desconto proporcionalmente nos itens do MP
───────────────────────────────────────────────────────── */
function buildMpItems(
  validatedItems,
  itemsTotal,
  itemsDiscount,
  finalShipping,
) {
  const items = [];
  let remaining = itemsDiscount;

  validatedItems.forEach((item, index) => {
    const subtotal = item.unit_price * item.quantity;
    let discount = 0;

    if (itemsDiscount > 0) {
      if (index === validatedItems.length - 1) {
        discount = remaining;
      } else {
        discount = Number(((subtotal / itemsTotal) * itemsDiscount).toFixed(2));
        remaining = Number((remaining - discount).toFixed(2));
      }
    }

    items.push({
      title: item.title,
      quantity: item.quantity,
      currency_id: "BRL",
      unit_price: Number(
        (Math.max(0, subtotal - discount) / item.quantity).toFixed(2),
      ),
    });
  });

  if (finalShipping > 0) {
    items.push({
      title: "Frete",
      quantity: 1,
      currency_id: "BRL",
      unit_price: Number(finalShipping.toFixed(2)),
    });
  }

  return items;
}

/* ─────────────────────────────────────────────────────────
   CONTROLLERS
───────────────────────────────────────────────────────── */

/* GET /payment/:id/link */
export const getPaymentLink = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    if (!order.payment?.mpPreferenceId)
      return res.status(400).json({ error: "Pedido não possui preference" });

    const pref = new Preference(client);
    const mpRes = await pref.get({
      preferenceId: order.payment.mpPreferenceId,
    });

    return res.json({ init_point: mpRes.init_point });
  } catch (err) {
    console.error("GET PAYMENT LINK:", err);
    res.status(500).json({ error: "Erro ao buscar link de pagamento" });
  }
};

/* POST /checkout */
export const createCheckoutController = async (req, res) => {
  try {
    const { items, customer, shippingAddress, shipping, coupon } = req.body;
    const user = await User.findById(req.user._id);

    // ── CPF ──────────────────────────────────────────────
    let cpfRaw, cpfHash;
    try {
      ({ cpfRaw, cpfHash } = await resolveCpf(customer?.cpf, user));
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    await saveCpfToUser(user, cpfRaw);
    maybeSaveAddress(user, shippingAddress);
    await user.save();

    // ── Valida produtos ──────────────────────────────────
    const validatedItems = [];
    for (const item of items) {
      if (item.type && item.type !== "product") continue;

      const product = await Product.findById(item.productId);
      if (!product)
        return res.status(404).json({ error: "Produto não encontrado" });
      if (product.stock < item.quantity)
        return res
          .status(400)
          .json({ error: `Estoque insuficiente: ${product.name}` });

      validatedItems.push({
        productId: product._id,
        title: product.name,
        quantity: Number(item.quantity),
        unit_price: Number(product.price),
        type: "product",
      });
    }

    const itemsTotal = validatedItems.reduce(
      (s, i) => s + i.unit_price * i.quantity,
      0,
    );
    const originalShipping = Number(shipping) || 0;

    // ── Cupom ────────────────────────────────────────────
    let couponResult;
    try {
      couponResult = await processCoupon({
        couponInput: coupon,
        userId: req.user._id,
        cpfHash,
        itemsTotal,
        originalShipping,
      });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const {
      itemsDiscount,
      shippingDiscount,
      finalShipping,
      affiliateData,
      couponMeta,
    } = couponResult;
    const safeItemsDiscount = Math.min(itemsDiscount, itemsTotal);
    const total = Number(
      (itemsTotal + finalShipping - safeItemsDiscount).toFixed(2),
    );

    // ── Monta itens para o Mercado Pago ─────────────────
    const mpItems = buildMpItems(
      validatedItems,
      itemsTotal,
      safeItemsDiscount,
      finalShipping,
    );

    // ── Cria pagamento Pix no MP ─────────────────────────
    const orderId = uuidv4();
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
          identification: { type: "CPF", number: cpfRaw },
        },
        notification_url: process.env.BACKEND_URL + "/payment/webhook",
      },
    });

    const pixData = payment.point_of_interaction.transaction_data;

    // ── Cria pedido no banco ─────────────────────────────
    await Order.create({
      orderId,
      userId: req.user._id,
      customer: { name: customer.name, email: customer.email },
      affiliate: affiliateData,
      items: validatedItems,
      coupon: couponMeta,
      totals: {
        items: Number(itemsTotal.toFixed(2)),
        subtotal: Number(itemsTotal.toFixed(2)),
        discount: Number(safeItemsDiscount.toFixed(2)),
        originalShipping: Number(originalShipping.toFixed(2)),
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
    console.error("CHECKOUT ERROR:", err);
    res.status(500).json({ error: "Erro ao criar checkout" });
  }
};

/* POST /payment/webhook */
export const webhookController = async (req, res) => {
  try {
    if (req.body?.type !== "payment") return res.sendStatus(200);

    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    let payment;
    try {
      const pc = new Payment(client);
      payment = await pc.get({ id: paymentId });
    } catch (err) {
      if (err.status === 404) return res.sendStatus(200);
      throw err;
    }

    if (!payment) return res.sendStatus(200);

    const orderId = payment.external_reference;
    if (!orderId) return res.sendStatus(200);

    const order = await Order.findOne({ orderId });
    if (!order) return res.sendStatus(200);

    const status = payment.status || "unknown";

    if (status === "cancelled") {
      order.payment.status = "rejected";
      order.payment.mpPaymentId = paymentId;
      await order.save();
      return res.sendStatus(200);
    }

    if (status === "approved" && order.payment.status !== "approved") {
      // 1. Marca cupom como usado (apenas PRIMEIRACOMPRA usa usedCoupons)
      if (order.coupon?.code === FIRST_PURCHASE_COUPON && order.userId) {
        await User.findByIdAndUpdate(order.userId, {
          $addToSet: {
            usedCoupons: { code: FIRST_PURCHASE_COUPON, usedAt: new Date() },
          },
        });
      }

      // 2. Baixa estoque
      for (const item of order.items) {
        if (item.type !== "product") continue;
        await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
        );
      }

      // 3. Comissão de afiliado
      if (order.affiliate?.userId && order.affiliate.status === "pending") {
        const affiliateUser = await User.findById(order.affiliate.userId);
        if (affiliateUser) {
          affiliateUser.affiliate.pendingBalance +=
            order.affiliate.commissionValue;
          affiliateUser.affiliate.totalEarned +=
            order.affiliate.commissionValue;
          await affiliateUser.save();
          order.affiliate.status = "approved";
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

/* GET /orders (meus pedidos) */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .populate("userId", "name email cpfEncrypted")
      .populate("items.productId", "stock name")
      .lean();

    const formatted = orders.map((order) => ({
      ...order,
      userId: order.userId
        ? {
            _id: order.userId._id,
            name: order.userId.name,
            email: order.userId.email,
            cpf: order.userId.cpfEncrypted
              ? maskCPF(decryptCPF(order.userId.cpfEncrypted))
              : null,
          }
        : null,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar pedidos" });
  }
};

/* GET /admin/orders */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId")
      .sort({ createdAt: -1 })
      .lean();
    const isAdmin = req.user?.role === "admin";

    const formatted = orders.map((order) => {
      const cpf = order.userId?.cpfEncrypted
        ? decryptCPF(order.userId.cpfEncrypted)
        : null;

      return {
        ...order,
        userId: order.userId
          ? {
              ...order.userId,
              cpf: isAdmin ? cpf : undefined,
              cpfEncrypted: undefined,
              cpfHash: undefined,
              password: undefined,
            }
          : null,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar pedidos" });
  }
};

/* PATCH /admin/orders/:id/status */
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { deliveryStatus: status },
      { new: true },
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
};

/* POST /payment/:id/pay (regerar Pix para pedido existente) */
export const payOrderController = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    if (order.payment.status === "approved")
      return res.status(400).json({ error: "Pedido já pago" });

    const user = await User.findById(order.userId);
    const cpfRaw = user?.cpfEncrypted ? decryptCPF(user.cpfEncrypted) : "";

    const pc = new Payment(client);
    const payment = await pc.create({
      body: {
        transaction_amount: order.totals.total,
        description: "Pagamento de pedido existente",
        payment_method_id: "pix",
        external_reference: order.orderId,
        payer: {
          email: order.customer.email,
          first_name: order.customer.name,
          identification: { type: "CPF", number: cpfRaw },
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
