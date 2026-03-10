import { Resend } from "resend";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API_KEY);
function getFrontendUrl() {
  const raw = process.env.FRONTEND_URL || "";

  // separa por vírgula e pega a primeira
  const firstUrl = raw.split(",")[0].trim();

  // garante que termina sem /
  return firstUrl.replace(/\/$/, "");
}

const frontend = getFrontendUrl();
export const sendVerificationEmail = async (email, token) => {
  if (!email || !token) {
    throw new Error("Email ou token não fornecido");
  }

  const link = `${process.env.BACKEND_URL}/auth/verify?token=${token}`;

  try {
    const response = await resend.emails.send({
      from: `Royal Parfums <${process.env.DOMAIN_NAME}>`,
      to: email,
      subject: "Confirme seu cadastro - Royal Parfums",
      html: `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:40px 0;">
        <div style="max-width:500px;margin:auto;background:white;border-radius:8px;padding:30px;text-align:center;">
          
          <h2 style="color:#111;margin-bottom:20px;">
            Confirme seu email
          </h2>

          <p style="color:#555;font-size:16px;margin-bottom:30px;">
            Obrigado por se cadastrar na <strong>Royal Parfums</strong>.<br>
            Clique no botão abaixo para ativar sua conta.
          </p>

          <a href="${link}" 
            style="
              display:inline-block;
              background:#C6A75E;
              color:white;
              padding:14px 26px;
              font-size:16px;
              text-decoration:none;
              border-radius:6px;
              font-weight:bold;
            ">
            Confirmar Email
          </a>

          <p style="margin-top:30px;color:#777;font-size:14px;">
            Se o botão não funcionar, copie e cole o link abaixo no navegador:
          </p>

          <p style="word-break:break-all;font-size:13px;color:#555;">
            ${link}
          </p>

          <hr style="margin:30px 0;border:none;border-top:1px solid #eee;" />

          <p style="font-size:12px;color:#999;">
            © ${new Date().getFullYear()} Royal Parfums<br>
            Este é um email automático, não responda.
          </p>

        </div>
      </div>
      `,
    });
    return response;
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    throw new Error("Falha ao enviar email de verificação");
  }
};

export const sendPasswordResetEmail = async (email, token) => {
  const link = `${frontend}/reset-password?token=${token}`;
  try {
    const response = await resend.emails.send({
      from: `Royal Parfums <${process.env.DOMAIN_NAME}>`,
      to: email,
      subject: "Redefinição de senha - Royal Parfums",
      html: `
      <div style="font-family:Arial;background:#f5f5f5;padding:40px">
        <div style="max-width:500px;margin:auto;background:white;padding:30px;border-radius:8px;text-align:center">
          
          <h2>Redefinir senha</h2>

          <p>
            Recebemos uma solicitação para redefinir sua senha.
          </p>

          <a href="${link}" 
          style="background:#C6A75E;color:white;padding:14px 26px;
          text-decoration:none;border-radius:6px;font-weight:bold;">
          Redefinir senha
          </a>

          <p style="margin-top:20px;font-size:13px;">
          Se não foi você, ignore este email.
          </p>

        </div>
      </div>
    `,
    });
    return response;
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    throw new Error("Falha ao enviar email de verificação");
  }
};
