import { Order } from "../models/Order.js";
import QRCode from "qrcode";

// Chave PIX fixa
const RECEIVER_PIX_KEY = "21973402054";

export const createOrder = async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, shipping } = req.body;

    const newOrder = new Order({
      items,
      totalAmount,
      shippingAddress,
      shipping,
      payment: "pix",
    });

    await newOrder.save();
    res.status(201).json({ order: newOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
};

// Endpoint para gerar PIX
export const generatePix = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    // Cria payload do PIX
    const pixPayload = `00020126580014BR.GOV.BCB.PIX0114${RECEIVER_PIX_KEY}0208${order.totalAmount.toFixed(2)}5204000053039865405${order.totalAmount.toFixed(2)}5802BR5913Meu Loja Test6009Sao Paulo61080540900062070503***6304ABCD`;

    order.pixPayload = pixPayload;
    await order.save();

    // Opcional: gerar QR Code em base64 já no backend
    const qrCodeUrl = await QRCode.toDataURL(pixPayload);

    res.json({ pixPayload, qrCodeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
};

// Simula webhook de pagamento
export const confirmPixPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    order.pixPaid = true;
    await order.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao confirmar pagamento" });
  }
};
