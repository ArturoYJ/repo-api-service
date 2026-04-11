import { Router, Request, Response } from 'express';
import { AuthService } from '../modules/auth/services/auth.service';
import { UsuariosRepository } from '../modules/auth/repositories/usuarios.repository';
import { PasswordResetService } from '../modules/auth/services/password-reset.service';
import { loginSchema, verifyTotpSchema, registrarUsuarioSchema, forgotPasswordSchema, resetPasswordSchema } from '../modules/auth/schemas/auth.schema';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';

export const authRouter = Router();

const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const resultado = loginSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({
        error: 'Datos de entrada inválidos',
        detalles: resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const { email, password } = resultado.data;
    const { preToken, ...clientResponse } = await AuthService.login(email, password);
    res.cookie('pre_auth_token', preToken, { ...AUTH_COOKIE_OPTS, maxAge: 5 * 60 * 1000 });
    res.status(200).json(clientResponse);
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.post('/verify-totp', async (req: Request, res: Response) => {
  try {
    const preToken = req.cookies?.pre_auth_token;
    if (!preToken) {
      res.status(401).json({ error: 'Sesión de verificación no encontrada. Inicia sesión nuevamente.' });
      return;
    }
    const resultado = verifyTotpSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        detalles: resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const { token, usuario } = await AuthService.verifyTotp(preToken, resultado.data.code);
    res.clearCookie('pre_auth_token', { path: '/' });
    res.cookie('auth_token', token, { ...AUTH_COOKIE_OPTS, maxAge: 60 * 60 * 24 * 1000 });
    res.status(200).json({ user: usuario, message: 'Inicio de sesión exitoso' });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token', { path: '/' });
  res.clearCookie('pre_auth_token', { path: '/' });
  res.status(200).json({ message: 'Sesión cerrada' });
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = await UsuariosRepository.findById(req.user!.userId);
    if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.status(200).json({ usuario });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.post('/register', async (req: Request, res: Response) => {
  const validation = registrarUsuarioSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: 'Datos inválidos',
      detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
    return;
  }
  try {
    const { nombre, email, password } = validation.data;
    const passwordHash = await AuthService.hashPassword(password);
    const usuario = await UsuariosRepository.create(nombre, email, passwordHash);
    res.status(201).json({ message: 'Usuario creado exitosamente', data: usuario });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const resultado = forgotPasswordSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({ error: 'Correo inválido' });
      return;
    }
    await PasswordResetService.requestReset(resultado.data.email);
    res.status(200).json({ message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña' });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const resultado = resetPasswordSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        detalles: resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    await PasswordResetService.resetPassword(resultado.data.token, resultado.data.password);
    res.status(200).json({ message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});