import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: `"GlamStock" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Tu código de verificación — GlamStock',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto">
        <h2 style="color:#850E35">Verificación de dos pasos</h2>
        <p>Usa el siguiente código para completar tu inicio de sesión:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.4rem;color:#111;text-align:center;padding:16px 0">
          ${code}
        </div>
        <p style="color:#666;font-size:0.85rem">Válido por 5 minutos. Si no iniciaste sesión, ignora este mensaje.</p>
      </div>
    `,
  });
}