import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { JWTPayload, LoginResponse, UsuarioSinPassword } from '../types/auth.types';
import { UnauthorizedError} from '@/lib/errors/app-error';

export class AuthService {
  
  private static getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('FATAL: JWT_SECRET no está definido en las variables de entorno');
    }
    return secret;
  }

  static async hashPassword(password: string): Promise<string> {
    // 10 rondas de salt es el estándar de la industria. 
    // Suficientemente lento para mitigar fuerza bruta, rápido para no bloquear el Event Loop.
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async login(email: string, passwordPlano: string): Promise<LoginResponse> {
    // 1. Buscar usuario
    const usuario = await UsuariosRepository.findByEmail(email);
    if (!usuario) {
      throw new UnauthorizedError('Credenciales inválidas'); 
    }

    // 2. Verificar que el usuario no esté inactivo
    if (!usuario.activo) {
      throw new UnauthorizedError('Esta cuenta ha sido desactivada. Contacte al administrador.');
    }

    // 3. Comparación criptográfica
    const passwordCoincide = await bcrypt.compare(passwordPlano, usuario.password_hash);
    if (!passwordCoincide) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    // 4. Generación del JWT
    const payload: JWTPayload = {
      userId: usuario.id_usuario,
      email: usuario.email,
      rol: usuario.rol,
    };

    const token = jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: '24h',
    });

    // 5. Retornar omitiendo datos sensibles
    const { password_hash, ...usuarioLimpio } = usuario;

    return {
      token,
      usuario: usuarioLimpio,
    };
  }

  static verifyToken(token: string): JWTPayload {
    try {
      const decodificado = jwt.verify(token, this.getJwtSecret()) as JWTPayload;
      return decodificado;
    } catch (error) {
      console.error('JWT Verification failed:', error);
      throw new UnauthorizedError('Token inválido o expirado');
    }
  }
}