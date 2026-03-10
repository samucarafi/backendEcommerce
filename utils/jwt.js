import jwt from "jsonwebtoken";
import "dotenv/config.js";

const { JWT_SECRET_KEY } = process.env;

export const JWTVerify = (token) => {
  if (!token) return null;

  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET_KEY, {}, (error, userInfo) => {
      if (error) return reject(error);
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
      },
    );
  });
};

export const JWTSignEmailVerification = (userId) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      { userId, type: "email-verification" },
      JWT_SECRET_KEY,
      { expiresIn: "1d" },
      (error, token) => {
        if (error) {
          reject(error);
        }
        resolve(token);
      },
    );
  });
};

export const JWTVerifyEmailToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET_KEY, {}, (error, decoded) => {
      if (error) return reject(error);

      if (decoded.type !== "email-verification") {
        return reject(new Error("Tipo de token inválido"));
      }

      resolve(decoded);
    });
  });
};

export const JWTSignPasswordReset = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    expiresIn: "15m",
  });
};

export const JWTVerifyPasswordReset = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET_KEY);
};
