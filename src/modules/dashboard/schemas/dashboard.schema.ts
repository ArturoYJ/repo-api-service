import { z } from 'zod';

/**
 * Schema para validar los query params opcionales del endpoint GET /api/dashboard/stats.
 * Todos los campos son opcionales: sin filtros retorna estadísticas globales.
 */
export const dashboardQuerySchema = z.object({
  fecha_inicio: z.coerce.date({ error: 'Fecha de inicio inválida' }).optional(),
  fecha_fin: z.coerce.date({ error: 'Fecha de fin inválida' }).optional(),
  top_limit: z.coerce
    .number({ error: 'top_limit debe ser un número' })
    .int('top_limit debe ser un entero')
    .positive('top_limit debe ser mayor a 0')
    .max(50, 'top_limit no puede ser mayor a 50')
    .default(10)
    .optional(),
}).refine(
  (data) => {
    // Si se proporciona una fecha, ambas deben estar presentes
    if (data.fecha_inicio && !data.fecha_fin) return false;
    if (!data.fecha_inicio && data.fecha_fin) return false;
    return true;
  },
  { message: 'Debe proporcionar ambas fechas (fecha_inicio y fecha_fin) o ninguna', path: ['fecha_fin'] }
).refine(
  (data) => {
    if (data.fecha_inicio && data.fecha_fin) {
      return data.fecha_fin >= data.fecha_inicio;
    }
    return true;
  },
  { message: 'La fecha de fin no puede ser anterior a la fecha de inicio', path: ['fecha_fin'] }
);

export type DashboardQueryDTO = z.infer<typeof dashboardQuerySchema>;
