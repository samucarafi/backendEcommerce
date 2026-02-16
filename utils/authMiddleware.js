import { JWTVerify } from "./jwt.js";

export const authTokenMiddleware = async (req, res, next) => {
  try {
    const userInfo = await JWTVerify(req);

    if (!userInfo) {
      return res.status(401).json({ error: "Token inválido" });
    }

    req.user = userInfo;

    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

export const adminMiddleware = (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Não autenticado" });

    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Acesso negado" });

    next();
  } catch {
    res.status(500).json({ error: "Erro de autorização" });
  }
};
