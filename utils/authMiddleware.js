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
