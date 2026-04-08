import { Router, Response } from 'express';
import { SucursalesService } from '../modules/sucursales/services/sucursales.service';
import { createSucursalSchema, updateSucursalSchema } from '../modules/sucursales/schemas/sucursales.schema';
import { idSchema } from '../lib/validations/common.schemas';
import { inventarioQuerySchema } from '../modules/inventario/schemas/inventario.schema';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';

export const sucursalesRouter = Router();

sucursalesRouter.use(requireAuth);

sucursalesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const soloActivas = req.query.activas === 'true';
    const sucursales = await SucursalesService.getAllSucursales(soloActivas);
    res.status(200).json({ data: sucursales, total: sucursales.length });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

sucursalesRouter.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const validation = createSucursalSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos de sucursal inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const sucursal = await SucursalesService.createSucursal(validation.data);
    res.status(201).json({ data: sucursal });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

sucursalesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de sucursal inválido' }); return; }
    const sucursal = await SucursalesService.getSucursalById(idValidation.data);
    res.status(200).json({ data: sucursal });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

sucursalesRouter.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de sucursal inválido' }); return; }
    const validation = updateSucursalSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos de sucursal inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const sucursal = await SucursalesService.updateSucursal(idValidation.data, validation.data);
    res.status(200).json({ data: sucursal });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

sucursalesRouter.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de sucursal inválido' }); return; }
    await SucursalesService.deleteSucursal(idValidation.data);
    res.status(200).json({ message: 'Sucursal eliminada correctamente' });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

sucursalesRouter.patch('/:id/toggle', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de sucursal inválido' }); return; }
    const sucursal = await SucursalesService.toggleActivo(idValidation.data);
    res.status(200).json({ data: sucursal });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

sucursalesRouter.get('/:id/inventario', async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de sucursal inválido' }); return; }
    const rawParams = {
      sku: req.query.sku as string | undefined,
      nombre: req.query.nombre as string | undefined,
      min_stock: req.query.min_stock as string | undefined,
      max_stock: req.query.max_stock as string | undefined,
    };
    const cleanParams = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => v !== undefined));
    const validation = inventarioQuerySchema.safeParse(cleanParams);
    if (!validation.success) {
      res.status(400).json({
        error: 'Parámetros de consulta inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const inventario = await SucursalesService.getInventarioByIdWithFilters(idValidation.data, validation.data);
    res.status(200).json({ data: inventario, total: inventario.length });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});