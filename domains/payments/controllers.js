import { MercadoPagoConfig, Preference } from "mercadopago";
import "dotenv/config.js";

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
