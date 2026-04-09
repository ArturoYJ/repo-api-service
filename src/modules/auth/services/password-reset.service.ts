import crypto from 'crypto';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { AuthService } from './auth.service';
import { sendPasswordResetEmail } from '@/lib/email/mailer';
import { NotFoundError, ValidationError } from '@/lib/errors/app-error';

const RESET_TTL_MINUTES = 30;

export class PasswordResetService {

  static async requestReset(email: string): Promise<void> {
    const usuario = await UsuariosRepository.findByEmail(email);
    if (!usuario || !usuario.activo) {
      return;
    }

    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await UsuariosRepository.saveResetToken(usuario.id_usuario, token, expiresAt);

    const resetUrl = `${process.env.FRONTEND_URL}/login/reset-password?token=${token}`;
    await sendPasswordResetEmail(usuario.email, resetUrl);
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const usuario = await UsuariosRepository.findByResetToken(token);
    if (!usuario) {
      throw new ValidationError('El enlace de restablecimiento es inválido o ha expirado');
    }

    const passwordHash = await AuthService.hashPassword(newPassword);
    await UsuariosRepository.updatePassword(usuario.id_usuario, passwordHash);
  }
}