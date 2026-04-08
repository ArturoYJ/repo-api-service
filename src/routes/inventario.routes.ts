import { Router, Response } from 'express';
import { z } from 'zod';
import { InventarioService } from '../modules/inventario/services/inventario.service';
import { InventarioRepository } from '../modules/inventario/repositories/inventario.repository';
import { SucursalesRepository } from '../modules/sucursales/repositories/sucursales.repository';
import { ajusteInventarioApiSchema, MOTIVOS_VALIDOS } from '../modules/inventario/schemas/inventario.schema';
import { idSchema } from '../lib/validations/common.schemas';
import { isAppError, NotFoundError } from '../lib/errors/app-error';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';

export const inventarioRouter = Router();

inventarioRouter.use(requireAuth);

const updateStockSchema = z.object({
  stock_actual: z.coerce.number().int().nonnegative('El stock no puede ser negativo'),
});

const registrarBajaApiSchema = z.object({
  id_variante: idSchema,
  id_sucursal: idSchema,
  motivo: z.enum(MOTIVOS_VALIDOS as unknown as [string, ...string[]], {
    error: `El motivo debe ser uno de los siguientes: ${MOTIVOS_VALIDOS.join(', ')}`,
  }),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser al menos 1'),
  precio_venta_final: z.coerce.number().nonnegative('El precio no puede ser negativo'),
});

inventarioRouter.get('/sucursales', async (_req: AuthRequest, res: Response) => {
  try {
    const sucursales = await SucursalesRepository.findActivas();
    res.status(200).json({ data: sucursales });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

inventarioRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rawSucursalId = req.query.sucursal_id as string | undefined;
    if (!rawSucursalId) {
      res.status(400).json({ error: 'El parámetro sucursal_id es requerido' });
      return;
    }
    const idValidation = idSchema.safeParse(rawSucursalId);
    if (!idValidation.success) {
      res.status(400).json({ error: `sucursal_id debe ser un número entero positivo` });
      return;
    }
    const inventario = await InventarioService.getInventarioBySucursal(idValidation.data);
    res.status(200).json({ data: inventario, total: inventario.length, sucursal_id: idValidation.data });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

inventarioRouter.get('/variante/:id', async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de variante inválido' }); return; }
    const registros = await InventarioRepository.findByVariante(idValidation.data);
    res.status(200).json({ data: registros });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

inventarioRouter.post('/ajuste', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const resultado = ajusteInventarioApiSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        detalles: resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const { id_variante, id_sucursal, cantidad, motivo } = resultado.data;
    const ajuste = await InventarioService.executarAjustePorCantidad({
      id_variante, id_sucursal, cantidad, motivo, id_usuario: req.user!.userId,
    });
    res.status(200).json({ message: 'Ajuste realizado correctamente', stock_nuevo: ajuste.stock_nuevo, id_transaccion: ajuste.id_transaccion });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

inventarioRouter.post('/baja', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const resultado = registrarBajaApiSchema.safeParse(req.body);
    if (!resultado.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        detalles: resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const { id_variante, id_sucursal, motivo, cantidad, precio_venta_final } = resultado.data;
    const id_motivo = await InventarioRepository.findMotivoPorDescripcion(motivo);
    if (id_motivo === null) throw new NotFoundError(`Motivo no encontrado: "${motivo}"`);
    const baja = await InventarioService.registrarBaja({
      id_variante, id_sucursal, id_motivo, id_usuario: req.user!.userId, cantidad, precio_venta_final,
    });
    res.status(200).json({ message: 'Baja registrada correctamente', stock_resultante: baja.stock_resultante, id_transaccion: baja.id_transaccion });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

inventarioRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de inventario inválido' }); return; }
    const registro = await InventarioRepository.findById(idValidation.data);
    if (!registro) { res.status(404).json({ error: 'Registro no encontrado' }); return; }
    res.status(200).json({ data: registro });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

inventarioRouter.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de inventario inválido' }); return; }
    const validation = updateStockSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const registro = await InventarioRepository.updateStockById(idValidation.data, validation.data.stock_actual);
    if (!registro) { res.status(404).json({ error: 'Registro no encontrado' }); return; }
    res.status(200).json({ data: registro });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});