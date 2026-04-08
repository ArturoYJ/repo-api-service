import { Router, Response } from 'express';
import { ProductosService } from '../modules/productos/services/productos.service';
import { crearProductoMaestroSchema, updateProductoSchema } from '../modules/productos/schemas/producto.schema';
import { paginationSchema, idSchema } from '../lib/validations/common.schemas';
import { isAppError } from '../lib/errors/app-error';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';

export const productosRouter = Router();

productosRouter.use(requireAuth);

productosRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const validation = paginationSchema.safeParse({ page: req.query.page, limit: req.query.limit });
    if (!validation.success) {
      res.status(400).json({ error: 'Parámetros de paginación inválidos', detalles: validation.error.format() });
      return;
    }
    const { page, limit } = validation.data;
    const resultado = await ProductosService.getAllProductos(page, limit);
    res.status(200).json(resultado);
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

productosRouter.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const validation = crearProductoMaestroSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos de producto inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const producto = await ProductosService.createProductoCompleto(validation.data);
    res.status(201).json(producto);
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

productosRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de producto inválido' }); return; }
    const producto = await ProductosService.getProductoById(idValidation.data);
    res.status(200).json(producto);
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

productosRouter.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de producto inválido' }); return; }
    const validation = updateProductoSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Datos de producto inválidos',
        detalles: validation.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }
    const producto = await ProductosService.updateProducto(idValidation.data, validation.data);
    res.status(200).json(producto);
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

productosRouter.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);
    if (!idValidation.success) { res.status(400).json({ error: 'ID de producto inválido' }); return; }
    await ProductosService.deleteProducto(idValidation.data);
    res.status(200).json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    if (isAppError(error)) { res.status(error.statusCode).json({ error: error.message }); return; }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});