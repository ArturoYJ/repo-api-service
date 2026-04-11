import { Router, Request, Response } from 'express';
import { AuthService } from '../modules/auth/services/auth.service';
import { UsuariosRepository } from '../modules/auth/repositories/usuarios.repository';
import { loginSchema, verifyTotpSchema } from '../modules/auth/schemas/auth.schema';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const resultado = loginSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({
        error: 'Datos de entrada inválidos',
        detalles: resultado.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
      return;
    }

    const { email, password } = resultado.data;
    const preAuthResponse = await AuthService.login(email, password);
    res.status(200).json(preAuthResponse);
  } catch (error) {
    if (isAppError(error)) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.post('/verify-totp', async (req: Request, res: Response) => {
  try {
    const resultado = verifyTotpSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({
        error: 'Datos de entrada inválidos',
        detalles: resultado.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
      return;
    }

    const { preToken, code } = resultado.data;
    const { token, usuario } = await AuthService.verifyTotp(preToken, code);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 1000,
      path: '/',
    });

    res.status(200).json({ user: usuario, message: 'Inicio de sesión exitoso' });
  } catch (error) {
    if (isAppError(error)) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token', { path: '/' });
  res.status(200).json({ message: 'Sesión cerrada' });
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = await UsuariosRepository.findById(req.user!.userId);
    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    res.status(200).json({ usuario });
  } catch (error) {
    if (isAppError(error)) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});