import Order from "./model.js";
import { Preference, Payment } from "mercadopago";
import { v4 as uuidv4 } from "uuid";
import { mpClient as client } from "../../config/mercadopago.js";
export const createCheckoutController = async (req, res) => {
  try {
    const { items, customer, shippingAddress, shipping } = req.body;

    const orderId = uuidv4();

    const itemsTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const itemsMp = [...items];
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
            number: customer.cpf,
          },
        },

        back_urls: {
          success: process.env.FRONTEND_URL + "/success",
          failure: process.env.FRONTEND_URL + "/failure",
          pending: process.env.FRONTEND_URL + "/pending",
        },

        notification_url: process.env.BACKEND_URL + "/payment/webhook",

        auto_return: "approved",
      },
    });

    await Order.create({
      orderId,
      userId: req.user?._id,
      customer,
      items,
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
    console.error(err);
    res.status(500).json({ error: "Erro ao criar checkout" });
  }
};

export const webhookController = async (req, res) => {
  try {
    if (req.body.type === "payment") {
      const paymentId = req.body.data.id;

      const paymentClient = new Payment(client);
      const payment = await paymentClient.get({ id: paymentId });

      const cpf = payment.body.payer?.identification?.number;

      const orderId = payment.external_reference;

      await Order.findOneAndUpdate(
        { orderId },
        {
          "payment.status": payment.body.status,
          "payment.mpPaymentId": paymentId,
          "payment.cpf": cpf,
        },
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
};

export const createOrder = async (req, res) => {
  try {
    const { items, totals, address, customer, preferenceId } = req.body;

    const order = await Order.create({
      orderId: "ORD-" + Date.now(),
      userId: req.user?._id,
      customer,
      items,
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
  const orders = await Order.find({ userId: req.user?._id }).sort({
    createdAt: -1,
  });

  res.json(orders);
};

export const getAllOrders = async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
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
