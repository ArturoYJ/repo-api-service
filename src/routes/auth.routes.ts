import { Router, Request, Response } from 'express';
import { AuthService } from '../modules/auth/services/auth.service';
import { UsuariosRepository } from '../modules/auth/repositories/usuarios.repository';
import { loginSchema, registrarUsuarioSchema } from '../modules/auth/schemas/auth.schema';
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
    const loginResponse = await AuthService.login(email, password);

    res.cookie('auth_token', loginResponse.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 1000,
      path: '/',
    });

    res.status(200).json({ user: loginResponse.usuario, message: 'Inicio de sesión exitoso' });
  } catch (error) {
    console.error('Error en login:', error);
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

authRouter.post('/register', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user!.rol !== 'ADMIN') {
    res.status(403).json({ error: 'Solo los administradores pueden crear usuarios' });
    return;
  }
  const validation = registrarUsuarioSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: 'Datos inválidos',
      detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
    return;
  }
  try {
    const { nombre, email, password, rol } = validation.data;
    const passwordHash = await AuthService.hashPassword(password);
    const usuario = await UsuariosRepository.create(nombre, email, passwordHash, rol);
    res.status(201).json({ message: 'Usuario creado exitosamente', data: usuario });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});