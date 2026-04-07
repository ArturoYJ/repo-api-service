import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { OtpService } from './otp.service';
import { JWTPayload, PreAuthPayload, PreAuthResponse, UsuarioSinPassword } from '../types/auth.types';
import { UnauthorizedError } from '@/lib/errors/app-error';

export class AuthService {

  private static getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('FATAL: JWT_SECRET no está definido');
    return secret;
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async login(email: string, passwordPlano: string): Promise<PreAuthResponse> {
    const usuario = await UsuariosRepository.findByEmail(email);
    if (!usuario) throw new UnauthorizedError('Credenciales inválidas');

    if (!usuario.activo) throw new UnauthorizedError('Esta cuenta ha sido desactivada. Contacte al administrador.');

    const passwordCoincide = await bcrypt.compare(passwordPlano, usuario.password_hash);
    if (!passwordCoincide) throw new UnauthorizedError('Credenciales inválidas');

    await OtpService.sendOtp(usuario.id_usuario, usuario.email);

    const prePayload: PreAuthPayload = { userId: usuario.id_usuario, email: usuario.email, pre: true };
    const preToken = jwt.sign(prePayload, this.getJwtSecret(), { expiresIn: '5m' });

    return { requires2fa: true, preToken };
  }

  static async verifyOtp(preToken: string, code: string): Promise<{ token: string; usuario: UsuarioSinPassword }> {
    let payload: PreAuthPayload;
    try {
      payload = jwt.verify(preToken, this.getJwtSecret()) as PreAuthPayload;
    } catch {
      throw new UnauthorizedError('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!payload.pre) throw new UnauthorizedError('Token inválido');

    await OtpService.verifyOtp(payload.userId, code);

    const usuario = await UsuariosRepository.findById(payload.userId);
    if (!usuario) throw new UnauthorizedError('Usuario no encontrado');

    const jwtPayload: JWTPayload = { userId: usuario.id_usuario, email: usuario.email, rol: usuario.rol };
    const token = jwt.sign(jwtPayload, this.getJwtSecret(), { expiresIn: '24h' });

    return { token, usuario };
  }

  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.getJwtSecret()) as JWTPayload;
    } catch {
      throw new UnauthorizedError('Token inválido o expirado');
    }
  }
}