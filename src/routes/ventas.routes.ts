import { Router, Response } from 'express';
import { VentasService } from '../modules/ventas/services/ventas.service';
import { registrarVentaSchema, historialQuerySchema } from '../modules/ventas/schemas/venta.schema';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';

export const ventasRouter = Router();

ventasRouter.use(requireAuth);
ventasRouter.use(requireRole('ADMIN', 'VENDEDOR'));

ventasRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const validation = registrarVentaSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos de venta inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const resultado = await VentasService.registrarVenta({ ...validation.data, id_usuario: req.user!.userId });
    res.status(201).json({ message: 'Venta registrada exitosamente', data: resultado });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

ventasRouter.get('/historial', async (req: AuthRequest, res: Response) => {
  try {
    const rawParams = {
      sucursal_id: req.query.sucursal_id as string | undefined,
      fecha_inicio: req.query.fecha_inicio as string | undefined,
      fecha_fin: req.query.fecha_fin as string | undefined,
    };
    const cleanParams = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => v !== undefined));
    const validation = historialQuerySchema.safeParse(cleanParams);
    if (!validation.success) {
      res.status(400).json({
        error: 'Parámetros inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const { sucursal_id, fecha_inicio, fecha_fin } = validation.data;
    const historial = await VentasService.getHistorialVentas({ id_sucursal: sucursal_id, fecha_inicio, fecha_fin });
    res.status(200).json({ data: historial, total: historial.length });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

ventasRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: 'ID de transacción inválido' }); return; }
    const resultado = await VentasService.revertirVenta(id);
    res.status(200).json({ message: 'Venta revertida exitosamente. El stock ha sido devuelto al inventario.', data: resultado });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error al intentar revertir la venta' });
  }
});