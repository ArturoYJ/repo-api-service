import { db } from '@/lib/db/client';
import { VentasRepository } from '../repositories/ventas.repository';
import { InventarioRepository } from '@/modules/inventario/repositories/inventario.repository';
import { refreshRankingViews } from '@/lib/db/refresh-views';
import {
  VentaDetallada,
  TotalVentas,
  RegistrarVentaInput,
  ResultadoVenta,
  FiltrosHistorial,
  UtilidadPorPeriodo,
} from '../types/ventas.types';
import { ValidationError, NotFoundError } from '@/lib/errors/app-error';
import { registrarVentaSchema } from '../schemas/venta.schema';

export class VentasService {

  static async registrarVenta(input: RegistrarVentaInput): Promise<ResultadoVenta> {
    const validation = registrarVentaSchema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError(validation.error.issues.map(i => i.message).join(', '));
    }

    const { id_variante, id_sucursal, id_motivo, cantidad, precio_venta_final } = validation.data;
    const { id_usuario } = input;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Verificar stock DENTRO de la transacción con bloqueo de fila (FOR UPDATE)
      // para evitar condiciones de carrera al descontar stock concurrentemente.
      const { rows: inventarioRows } = await client.query(
        `SELECT stock_actual FROM inventario_sucursal
         WHERE id_variante = $1 AND id_sucursal = $2
         FOR UPDATE;`,
        [id_variante, id_sucursal]
      );

      if (inventarioRows.length === 0) {
        throw new NotFoundError('No existe inventario para esta variante en la sucursal indicada');
      }

      if (inventarioRows[0].stock_actual < cantidad) {
        throw new ValidationError(
          `Stock insuficiente. Disponible: ${inventarioRows[0].stock_actual}, Solicitado: ${cantidad}`
        );
      }

      // Registrar la venta
      const insertQuery = `
        INSERT INTO ventas_bajas (id_variante, id_sucursal, id_motivo, id_usuario, cantidad, precio_venta_final, fecha_hora)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING id_transaccion;
      `;
      const { rows: ventaRows } = await client.query(insertQuery, [
        id_variante, id_sucursal, id_motivo, id_usuario, cantidad, precio_venta_final,
      ]);

      // Descontar stock atómicamente
      const updateQuery = `
        UPDATE inventario_sucursal
        SET stock_actual = stock_actual - $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_variante = $2 AND id_sucursal = $3
          AND stock_actual >= $1
        RETURNING stock_actual;
      `;
      const { rows: stockRows } = await client.query(updateQuery, [cantidad, id_variante, id_sucursal]);

      if (stockRows.length === 0) {
        throw new ValidationError('No se pudo descontar el stock (posible concurrencia)');
      }

      await client.query('COMMIT');

      // Refrescar vistas materializadas de ranking después de cada venta
      await refreshRankingViews();

      return {
        id_transaccion: ventaRows[0].id_transaccion,
        stock_restante: stockRows[0].stock_actual,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as NodeJS.ErrnoException & { code?: string }).code === 'P0001') {
        throw new ValidationError((error as Error).message);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async getHistorialVentas(filtros: FiltrosHistorial = {}): Promise<VentaDetallada[]> {
    const { id_sucursal, fecha_inicio, fecha_fin } = filtros;

    if (id_sucursal && fecha_inicio && fecha_fin) {
      return VentasRepository.findBySucursalAndDateRange(id_sucursal, fecha_inicio, fecha_fin);
    }
    if (id_sucursal) {
      return VentasRepository.findBySucursal(id_sucursal);
    }
    if (fecha_inicio && fecha_fin) {
      return VentasRepository.findByDateRange(fecha_inicio, fecha_fin);
    }
    return VentasRepository.findAll();
  }

  static async calcularUtilidades(
    fecha_inicio: Date,
    fecha_fin: Date,
    agruparPor: 'dia' | 'mes' = 'mes'
  ): Promise<UtilidadPorPeriodo[]> {
    const formato = agruparPor === 'dia' ? 'YYYY-MM-DD' : 'YYYY-MM';
    const query = `
      SELECT
        TO_CHAR(vb.fecha_hora, $1) AS periodo,
        COUNT(*) AS total_ventas,
        ROUND(SUM(COALESCE(vb.precio_venta_final, 0) * vb.cantidad), 2) AS ingresos_totales,
        ROUND(SUM((COALESCE(vb.precio_venta_final, 0) - v.precio_adquisicion) * vb.cantidad), 2) AS utilidad_total
      FROM ventas_bajas vb
      JOIN variantes v ON vb.id_variante = v.id_variante
      WHERE vb.fecha_hora BETWEEN $2 AND $3
      GROUP BY TO_CHAR(vb.fecha_hora, $1)
      ORDER BY periodo ASC;
    `;
    const { rows } = await db.query(query, [formato, fecha_inicio, fecha_fin]);
    return rows.map(r => ({
      periodo: r.periodo,
      total_ventas: Number(r.total_ventas),
      ingresos_totales: Number(r.ingresos_totales),
      utilidad_total: Number(r.utilidad_total),
    }));
  }

  static async revertirVenta(id_transaccion: number): Promise<{ id_transaccion: number; stock_actualizado: number }> {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Obtener datos de la transacción para revertir el stock
      const { rows: ventaRows } = await client.query(
        `SELECT id_variante, id_sucursal, cantidad FROM ventas_bajas WHERE id_transaccion = $1 FOR UPDATE;`,
        [id_transaccion]
      );

      if (ventaRows.length === 0) {
        throw new NotFoundError('No se encontró la transacción de venta especificada');
      }

      const { id_variante, id_sucursal, cantidad } = ventaRows[0];

      // 2. Devolver el stock a la sucursal correspondiente
      const updateStockQuery = `
        UPDATE inventario_sucursal
        SET stock_actual = stock_actual + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_variante = $2 AND id_sucursal = $3
        RETURNING stock_actual;
      `;
      const { rows: stockRows } = await client.query(updateStockQuery, [cantidad, id_variante, id_sucursal]);

      if (stockRows.length === 0) {
        throw new ValidationError('No se pudo actualizar el stock del inventario');
      }

      // 3. Eliminar el registro de la venta
      await client.query(`DELETE FROM ventas_bajas WHERE id_transaccion = $1;`, [id_transaccion]);

      await client.query('COMMIT');

      // 4. Refrescar vistas materializadas de ranking
      await refreshRankingViews();

      return {
        id_transaccion,
        stock_actualizado: stockRows[0].stock_actual,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}