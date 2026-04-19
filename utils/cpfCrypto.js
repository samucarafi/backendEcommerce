/**
 * utils/cpfCrypto.js
 *
 * Funções de segurança para CPF:
 *
 *  encryptCPF / decryptCPF  – AES-256 reversível (exibição mascarada)
 *  hashCPF                  – SHA-256 one-way   (comparações / buscas)
 *
 * A variável de ambiente CPF_SECRET deve ter pelo menos 32 caracteres.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const SECRET = process.env.CPF_SECRET || "e9y0z1x2w3v4u5t6s7r8q9p0o1n2m3l4";
const KEY = crypto.scryptSync(SECRET, "royal-salt", 32);

/* ─── AES encrypt ─────────────────────────────────────── */
export function encryptCPF(cpf) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(cpf, "utf8"), cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/* ─── AES decrypt ─────────────────────────────────────── */
export function decryptCPF(encryptedData) {
  const [ivHex, dataHex] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/* ─── SHA-256 one-way hash ────────────────────────────── */
/**
 * Gera hash determinístico do CPF (apenas dígitos).
 * Usado para comparar CPFs sem armazenar o valor real.
 *
 * @param {string} cpf  – CPF limpo (só números) ou formatado
 * @returns {string}    – hex SHA-256
 */
export function hashCPF(cpf) {
  const digits = cpf.replace(/\D/g, "");

  return crypto
    .createHmac("sha256", SECRET) // HMAC evita rainbow-table
    .update(digits)
    .digest("hex");
}

/* ─── Mask for display ────────────────────────────────── */
export function maskCPF(cpf) {
  if (!cpf) return null;
  const n = cpf.replace(/\D/g, "");
  return n.replace(/^(\d{3})\d{6}(\d{2})$/, "$1******$2");
}
