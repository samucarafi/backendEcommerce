import { Router } from "express";
import Order from "./model.js";
import "dotenv/config";
import { JWTVerify } from "../../utils/jwt.js";
const router = Router();

// router.post("/", async (req, res) => {

//   const { place, user, price, total, checkin, checkout, guests, nights } =
//     req.body;

//   try {
//     const newBookingDoc = await Booking.create({
//       place,
//       user,
//       price,
//       total,
//       checkin,
//       checkout,
//       guests,
//       nights,
//     });

//     res.json(newBookingDoc);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json("Deu erro ao criar a reserva");
//   }
// });
// const client = new MercadoPagoConfig({
//   accessToken: process.env.MP_ACCESS_TOKEN,
// });

// router.post("/create-preference", async (req, res) => {
//   try {
//     const { items } = req.body;
//     if (!items || items.length === 0) {
//       return res
//         .status(400)
//         .json({ error: "Itens do pedido são obrigatórios" });
//     }

//     const preference = new Preference(client);

//     const result = await preference.create({
//       body: {
//         items: items.map((item) => ({
//           title: item.title,
//           quantity: Number(item.quantity),
//           unit_price: Number(item.unit_price),
//         })),
//         // back_urls: {
//         //   success: "https://e-commerce-roupas-lovat.vercel.app/success",
//         //   failure: "https://e-commerce-roupas-lovat.vercel.app/failure",
//         //   pending: "https://e-commerce-roupas-lovat.vercel.app/pending",
//         // },
//         // auto_return: "approved",
//       },
//     });

//     const preferenceId = result.id;
//     const userInfo = await JWTVerify(req);
//     if (!userInfo) {
//       return res.status(401).json({ error: "Não autorizado" });
//     }
//     const { _id } = userInfo;

//     const orderNumber = `${Date.now()}${Math.floor(
//       1000 + Math.random() * 9000
//     )}`;

//     await Order.create({
//       orderNumber: orderNumber,
//       preferenceId,
//       owner: _id,
//       items: items,
//     });

//     return res.status(201).json(result);
//   } catch (error) {
//     console.error("Erro ao criar preferência:", error);
//     res.status(500).json({ error: "Erro ao criar preferência" });
//   }
// });

// router.get("/get-preference", async (req, res) => {
//   try {
//     const preference = new Preference(client);
//     //const { preferenceId } = req.body;
//     // Verificação do token
//     let userInfo;
//     try {
//       userInfo = await JWTVerify(req);
//     } catch (err) {
//       return res.status(401).json({ error: "Token inválido ou expirado" });
//     }
//     if (!userInfo) {
//       return res.status(401).json("Não autorizado");
//     }
//     const { _id } = userInfo;
//     const orders = await Order.find({ owner: _id });
//     const userOrders = [];
//     for (const order of orders) {
//       const result = await preference.get({ preferenceId: order.preferenceId });
//       userOrders.push(result);
//     }
//     return res.json(userOrders);
//   } catch (error) {
//     console.error("Erro inesperado em /get-preference:", error);
//     return res.status(500).json({ error: "Erro interno no servidor" });
//   }
// });

export default router;
