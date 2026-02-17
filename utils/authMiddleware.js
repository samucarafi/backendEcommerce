import { JWTVerify } from "./jwt.js";

export const authTokenMiddleware = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Token ausente" });

    const userInfo = await JWTVerify(token);

    req.user = userInfo;

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

export const adminMiddleware = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token ausente" });
    const userInfo = await JWTVerify(token);
    if (!userInfo) return res.status(401).json({ error: "Não autenticado" });

    if (userInfo.role !== "admin")
      return res.status(403).json({ error: "Acesso negado" });
    req.user = userInfo;
    next();
  } catch {
    res.status(500).json({ error: "Erro de autorização" });
  }
};
