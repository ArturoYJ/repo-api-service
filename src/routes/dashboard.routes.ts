import { Router, Response } from 'express';
import { DashboardService } from '../modules/dashboard/services/dashboard.service';
import { dashboardQuerySchema } from '../modules/dashboard/schemas/dashboard.schema';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const rawParams = {
      fecha_inicio: req.query.fecha_inicio as string | undefined,
      fecha_fin: req.query.fecha_fin as string | undefined,
      top_limit: req.query.top_limit as string | undefined,
    };
    const cleanParams = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => v !== undefined));
    const validation = dashboardQuerySchema.safeParse(cleanParams);
    if (!validation.success) {
      res.status(400).json({
        error: 'Parámetros de consulta inválidos',
        detalles: validation.error.issues.map((issue) => ({ campo: issue.path.join('.'), mensaje: issue.message })),
      });
      return;
    }
    const { fecha_inicio, fecha_fin, top_limit } = validation.data;
    const dashboard = await DashboardService.getDashboardCompleto({ fecha_inicio, fecha_fin, top_limit });
    res.status(200).json({ data: dashboard });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});