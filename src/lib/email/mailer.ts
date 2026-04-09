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

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await transporter.sendMail({
    from: `"GlamStock" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Restablece tu contraseña — GlamStock',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#850E35">Restablecer contraseña</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>Haz clic en el siguiente botón para continuar. El enlace expira en <strong>30 minutos</strong>.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${resetUrl}"
             style="background:#850E35;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">
            Restablecer contraseña
          </a>
        </div>
        <p style="color:#666;font-size:0.85rem">
          Si no solicitaste esto, ignora este mensaje. Tu contraseña no cambiará.
        </p>
      </div>
    `,
  });
}