import { z } from 'zod';
import { idSchema } from '@/lib/validations/common.schemas';

export const MOTIVOS_VALIDOS = [
  'Venta directa al cliente',
  'Baja por merma / daño',
  'Ajuste de inventario (Sobrante)',
  'Ajuste de inventario (Faltante)',
  'Ingreso por adquisición / compra',
] as const;

export type MotivoValido = typeof MOTIVOS_VALIDOS[number];

export const inventarioQuerySchema = z.object({
    sku: z.string().optional(),
    nombre: z.string().optional(),
    min_stock: z.coerce.number().int().nonnegative('El stock mínimo no puede ser negativo').optional(),
    max_stock: z.coerce.number().int().nonnegative('El stock máximo no puede ser negativo').optional(),
});

export const ajusteStockSchema = z.object({
  id_variante: idSchema,
  id_sucursal: idSchema,
  stock_actual: z.coerce.number().int().nonnegative('El stock no puede ser un número negativo'),
});

export const registrarBajaSchema = z.object({
  id_variante: idSchema,
  id_sucursal: idSchema,
  id_motivo: idSchema,
  cantidad: z.coerce.number().int().positive('La cantidad debe ser al menos 1'),
  precio_venta_final: z.coerce.number().nonnegative('El precio no puede ser negativo'),
});

export const ajustarInventarioSchema = z.object({
  id_variante: idSchema,
  id_sucursal: idSchema,
  id_motivo: idSchema,
  cantidad_nueva: z.coerce.number().int().nonnegative('La cantidad no puede ser negativa'),
});

export const ajusteInventarioApiSchema = z.object({
  id_variante: idSchema,
  id_sucursal: idSchema,
  cantidad: z.coerce
    .number()
    .int('La cantidad debe ser un número entero')
    .refine((v) => v !== 0, { message: 'La cantidad no puede ser cero' }),
  motivo: z.enum(MOTIVOS_VALIDOS, {
    error: `El motivo debe ser uno de los siguientes: ${MOTIVOS_VALIDOS.join(', ')}`,
  }),
});

export type AjusteStockDTO = z.infer<typeof ajusteStockSchema>;
export type RegistrarBajaDTO = z.infer<typeof registrarBajaSchema>;
export type AjustarInventarioDTO = z.infer<typeof ajustarInventarioSchema>;
export type AjusteInventarioApiDTO = z.infer<typeof ajusteInventarioApiSchema>;
export type InventarioQueryDTO = z.infer<typeof inventarioQuerySchema>;