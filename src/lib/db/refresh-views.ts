import { db } from '@/lib/db/client';

/**
 * Refresca las dos vistas materializadas de ranking de productos.
 * Usa CONCURRENTLY para no bloquear lecturas simultáneas.
 * Llamar después de registrar o modificar ventas.
 */
export async function refreshRankingViews(): Promise<void> {
  await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY vista_ranking_productos_global;`);
  await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY vista_ranking_productos_por_sucursal;`);
}
