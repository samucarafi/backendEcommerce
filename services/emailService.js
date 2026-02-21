import { Resend } from "resend";
import "dotenv/config.js";
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (email, token) => {
  const link = `${process.env.BACKEND_URL}/auth/verify?token=${token}`;

  const data = await resend.emails.send({
    from: `Royal <${process.env.DOMAIN_NAME}>`,
    to: email,
    subject: "Confirme seu cadastro",
    html: `
      <div style="font-family:Arial;padding:20px">
        <h2>Confirme seu email</h2>
        <p>Clique no botão abaixo para ativar sua conta:</p>
        <a href="${link}" 
           style="background:#C6A75E;color:white;padding:10px 20px;
           text-decoration:none;border-radius:5px;">
          Confirmar Email
        </a>
      </div>
    `,
  });
};
