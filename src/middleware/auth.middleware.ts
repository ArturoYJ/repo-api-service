import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/modules/auth/services/auth.service';
import { JWTPayload } from '../modules/auth/types/auth.types';
import { isAppError } from '../lib/errors/app-error';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      res.status(401).json({ error: 'No autorizado. Token no encontrado.' });
      return;
    }

    const payload = AuthService.verifyToken(token);
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