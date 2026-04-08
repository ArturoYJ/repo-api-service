import { Router, Response } from 'express';
import { z } from 'zod';
import { VariantesService } from '../modules/productos/services/variantes.service';
import { VariantesRepository } from '../modules/productos/repositories/variantes.repository';
import { varianteSchema } from '../modules/productos/schemas/producto.schema';
import { idSchema } from '../lib/validations/common.schemas';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';

export const variantesRouter = Router();

variantesRouter.use(requireAuth);

const agregarVarianteSchema = varianteSchema.extend({
  id_producto_maestro: z.coerce.number().int().positive(),
  fecha_compra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional().nullable(),
});

const updateVarianteSchema = z.object({
  precio_adquisicion: z.coerce.number().nonnegative().optional(),
  precio_venta_etiqueta: z.coerce.number().nonnegative().optional(),
  modelo: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  codigo_barras: z.string().min(3).max(100).optional(),
  sku_variante: z.string().min(3).max(100).optional(),
  fecha_compra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').nullable().optional(),
});

variantesRouter.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const validation = agregarVarianteSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Datos de variante inválidos', detalles: validation.error.format() });
      return;
    }
    const { id_producto_maestro, ...varianteData } = validation.data;
    const nuevaVariante = await VariantesService.addVariante(id_producto_maestro, varianteData);
    res.status(201).json(nuevaVariante);
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

variantesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const validation = idSchema.safeParse(req.params.id);
    if (!validation.success) { res.status(400).json({ error: 'ID inválido' }); return; }
    const variante = await VariantesRepository.findById(validation.data);
    if (!variante) { res.status(404).json({ error: 'Variante no encontrada' }); return; }
    res.status(200).json({ data: variante });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

variantesRouter.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de variante inválido' }); return; }
    const validation = updateVarianteSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const variante = await VariantesService.updateVariante(idValidation.data, validation.data);
    res.status(200).json({ data: variante });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});