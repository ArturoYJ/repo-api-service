import { Router, Response } from 'express';
import { InventarioRepository } from '../modules/inventario/repositories/inventario.repository';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';

export const motivosRouter = Router();

motivosRouter.use(requireAuth);
motivosRouter.use(requireRole('ADMIN', 'VENDEDOR'));

motivosRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const motivos = await InventarioRepository.findAllMotivos();
    res.status(200).json({ data: motivos });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});