import jwt from "jsonwebtoken";
import "dotenv/config.js";

const { JWT_SECRET_KEY } = process.env;

export const JWTVerify = (req) => {
  const { token } = req.cookies;
  if (!token) {
    return null;
  }
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET_KEY, {}, (error, userInfo) => {
      if (error) {
        console.error("Deu algum erro ao verificar com o JWT:", error);
        reject(error);
      }
      resolve(userInfo);
    });
  });
};

export const JWTSign = (newUserObj) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      newUserObj,
      JWT_SECRET_KEY,
      {
        expiresIn: "2h",
      },
      (error, token) => {
        if (error) {
          console.error("Error signing token:", error);
          reject(error);
        }
        resolve(token);
      }
    );
  });
};
