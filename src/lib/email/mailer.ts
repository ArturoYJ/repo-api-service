import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await resend.emails.send({
    from: 'GlamStock <onboarding@resend.dev>',
    to,
    subject: 'Restablece tu contraseña — GlamStock',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#850E35">Restablecer contraseña</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>Haz clic en el siguiente botón. El enlace expira en <strong>30 minutos</strong>.</p>
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