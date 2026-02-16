import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import "dotenv/config.js";
import axios from "axios";
import { mpClient } from "../../config/mercadopago.js";

// Configuração do Mercado Pago com Access Token
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Criar preferência de pagamento
export const createPreferenceController = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Itens do pedido são obrigatórios" });
    }

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: items.map((item) => ({
          title: item.title,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
        back_urls: {
          success: "https://e-commerce-roupas-lovat.vercel.app/success",
          failure: "https://e-commerce-roupas-lovat.vercel.app/failure",
          pending: "https://e-commerce-roupas-lovat.vercel.app/pending",
        },
        auto_return: "approved",
      },
    });

    res.json(result);
  } catch (error) {
    console.error("Erro ao criar preferência:", error);
    res.status(500).json({ error: "Erro ao criar preferência" });
  }
};

// export const calculateFreteController = async (req, res) => {
//   try {
//     const { from, to, products } = req.body;
//     const response = await axios.post(
//       "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
//       {
//         from,
//         to,
//         products,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
//           Accept: "application/json",
//           "Content-Type": "application/json",
//           "User-Agent": "SuaLoja (samucarafino@gmail.com)",
//         },
//       },
//     );

//     res.json(response.data);
//   } catch (error) {
//     console.error(error.response?.data || error.message);
//     res.status(500).json({ error: "Erro ao calcular frete" });
//   }
// };

export const statusByIdController = async (req, res) => {
  try {
    const payment = new Payment(mpClient);

    const result = await payment.get({
      id: req.params.id,
    });

    res.json({ status: result.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao consultar status" });
  }
};

export const webhookController = async (req, res) => {
  try {
    if (req.body.type === "payment") {
      const paymentId = req.body.data.id;

      const payment = new Payment(mpClient);

      const result = await payment.get({ id: paymentId });

      console.log("Webhook status:", result.status);

      /*
      AQUI você deve:
      - buscar pedido no banco
      - marcar como pago se status === approved
      - liberar envio
      */
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
};

export const createPixController = async (req, res) => {
  try {
    const { items, shippingCost, payer } = req.body;

    if (!items?.length)
      return res.status(400).json({ error: "Carrinho vazio" });

    const productsTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const total = Number(productsTotal) + Number(shippingCost || 0);

    const payment = new Payment(mpClient);
    //colocar cpf da pessoa
    console.log({
      total,
      email: payer.email,
      token: process.env.MP_ACCESS_TOKEN,
    });
    console.log("WEBHOOK URL:", `${process.env.BACKEND_URL}/webhook`);
    console.log("TOTAL:", total, typeof total);
    const result = await payment.create({
      body: {
        transaction_amount: Number(total),
        description: "Compra na loja",
        payment_method_id: "pix",
        payer: {
          email: payer.email,
          first_name: payer.first_name,
          identification: {
            type: "CPF",
            number: "11632163640",
          },
        },
        notification_url: `${process.env.BACKEND_URL}/payment/webhook`,
      },
    });

    return res.json({
      payment_id: result.id,
      status: result.status,
      qr_code: result.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        result.point_of_interaction.transaction_data.qr_code_base64,
    });
  } catch (error) {
    console.error("ERRO COMPLETO:", JSON.stringify(error, null, 2));

    res.status(500).json({
      message: "Erro ao gerar PIX",
      detail: error?.message,
      cause: error?.cause,
    });
  }
};
