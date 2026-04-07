import { db } from '@/lib/db/client';
import { sendOtpEmail } from '@/lib/email/mailer';
import { UnauthorizedError } from '@/lib/errors/app-error';

const OTP_TTL_MINUTES = 5;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class OtpService {
  static async sendOtp(userId: number, email: string): Promise<void> {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await db.query(
      `UPDATE usuarios SET otp_code = $1, otp_expires_at = $2 WHERE id_usuario = $3`,
      [code, expiresAt, userId]
    );

    await sendOtpEmail(email, code);
  }

  static async verifyOtp(userId: number, code: string): Promise<void> {
    const { rows } = await db.query(
      `SELECT otp_code, otp_expires_at FROM usuarios WHERE id_usuario = $1`,
      [userId]
    );

    const row = rows[0];

    if (!row || !row.otp_code || !row.otp_expires_at) {
      throw new UnauthorizedError('No hay un código de verificación activo');
    }

    if (new Date() > new Date(row.otp_expires_at)) {
      throw new UnauthorizedError('El código ha expirado');
    }

    if (row.otp_code !== code) {
      throw new UnauthorizedError('Código incorrecto');
    }

    await db.query(
      `UPDATE usuarios SET otp_code = NULL, otp_expires_at = NULL WHERE id_usuario = $1`,
      [userId]
    );
  }
}