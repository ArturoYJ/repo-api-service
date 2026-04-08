import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/modules/auth/services/auth.service';
import { UsuariosRepository } from '@/modules/auth/repositories/usuarios.repository';
import { JWTPayload } from '../modules/auth/types/auth.types';
import { isAppError } from '../lib/errors/app-error';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.auth_token;
    if (!token) {
      res.status(401).json({ error: 'No autorizado. Token no encontrado.' });
      return;
    }
    const payload = AuthService.verifyToken(token);
    const usuario = await UsuariosRepository.findById(payload.userId);
    if (!usuario || !usuario.activo) {
      res.status(401).json({ error: 'Usuario inactivo o no encontrado.' });
      return;
    }
    req.user = payload;
    next();
  } catch (error) {
    if (isAppError(error)) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export function requireRole(...roles: Array<'ADMIN' | 'VENDEDOR' | 'AUDITOR'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
      return;
    }
    next();
  };
}