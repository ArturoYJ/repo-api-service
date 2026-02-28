import { z } from 'zod';
import { CreateVarianteInput } from '../types/variantes.types';

export const varianteSchema = z.object({
  codigo_barras: z.string().min(3).max(100).optional(),
  modelo: z.string().max(100).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  precio_adquisicion: z.coerce.number().nonnegative('El costo no puede ser negativo'),
  precio_venta_etiqueta: z.coerce.number().nonnegative('El precio no puede ser negativo'),
  sucursal_id: z.coerce.number().int().positive('Debe especificar una sucursal'),
  stock_inicial: z.coerce.number().int().nonnegative().default(0),
}).refine((data) => data.precio_venta_etiqueta >= data.precio_adquisicion, {
  message: "El precio de venta no puede ser menor al costo de adquisición",
  path: ["precio_venta_etiqueta"],
});

export const crearProductoMaestroSchema = z.object({
  sku: z.string().min(3, 'El SKU debe tener al menos 3 caracteres').max(50).optional(),
  nombre: z.string().min(2).max(150),
  variantes: z.array(varianteSchema).optional().default([]),
});

export const updateProductoSchema = z.object({
  sku: z.string().min(3, 'El SKU debe tener al menos 3 caracteres').max(50).optional(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150).optional(),
}).refine((data) => data.sku !== undefined || data.nombre !== undefined, {
  message: 'Debe proporcionar al menos un campo para actualizar',
});

export type { CreateVarianteInput as VarianteDTO };
export type CrearProductoDTO = z.infer<typeof crearProductoMaestroSchema>;
export type UpdateProductoDTO = z.infer<typeof updateProductoSchema>;