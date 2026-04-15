import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

export const app = express();
app.use(express.json());
app.use(cookieParser());
const allowedOrigins = process.env.FRONTEND_URL.split(",").map((origin) =>
  origin.trim(),
);

app.use(
  cors({
    credentials: true,
    origin: function (origin, callback) {
      // permite requests sem origin (Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Origin bloqueada:", origin); // DEBUG
      return callback(new Error("CORS não permitido"));
    },
  }),
);
app.use("/tmp", express.static(__dirname + "/tmp"));
app.use(routes);
