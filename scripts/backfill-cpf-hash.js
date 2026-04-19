/**
 * scripts/backfill-cpf-hash.js
 *
 * Roda UMA VEZ para preencher o campo `cpfHash` nos usuários
 * que já têm `cpfEncrypted` salvo no banco.
 *
 * Uso:
 *   node scripts/backfill-cpf-hash.js
 *
 * Requer: variáveis de ambiente CPF_SECRET e MONGODB_URI carregadas.
 */

import "dotenv/config.js";
import mongoose from "mongoose";
import { decryptCPF, hashCPF } from "../utils/cpfCrypto.js";
import User from "../domains/users/model.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Conectado ao MongoDB.");

  const users = await User.find({
    cpfEncrypted: { $exists: true, $ne: null },
    cpfHash: { $exists: false }, // só os que ainda não têm hash
  });

  console.log(`Encontrados ${users.length} usuário(s) para atualizar.`);

  let ok = 0,
    fail = 0;

  for (const user of users) {
    try {
      const raw = decryptCPF(user.cpfEncrypted);
      user.cpfHash = hashCPF(raw);
      await user.save();
      ok++;
    } catch (e) {
      console.error(`Erro no usuário ${user._id}:`, e.message);
      fail++;
    }
  }

  console.log(`Concluído. OK: ${ok} | Erro: ${fail}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
