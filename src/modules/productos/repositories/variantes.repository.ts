import { db } from '@/lib/db/client';
import {
  Variante,
  CreateVarianteInput,
  UpdateVarianteInput,
} from '../types/variantes.types';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors/app-error';

export class VariantesRepository {

  static async create(idProductoMaestro: number, data: CreateVarianteInput): Promise<Variante> {
    const productoQuery = `SELECT id_producto_maestro FROM productos_maestros WHERE id_producto_maestro = $1;`;
    const { rows: productoRows } = await db.query(productoQuery, [idProductoMaestro]);
    if (productoRows.length === 0) {
      throw new NotFoundError('Producto maestro no encontrado');
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const varianteQuery = `
        INSERT INTO variantes (id_producto_maestro, sku_variante, codigo_barras, modelo, color, precio_adquisicion, precio_venta_etiqueta)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id_variante, id_producto_maestro, sku_variante, codigo_barras, modelo, color,
                  precio_adquisicion, precio_venta_etiqueta, etiqueta_generada, created_at;
      `;
      const { rows } = await client.query(varianteQuery, [
        idProductoMaestro,
        data.sku_variante,
        data.codigo_barras,
        data.modelo ?? null,
        data.color ?? null,
        data.precio_adquisicion,
        data.precio_venta_etiqueta,
      ]);
      const variante = rows[0];

      const inventarioQuery = `
        INSERT INTO inventario_sucursal (id_variante, id_sucursal, stock_actual)
        VALUES ($1, $2, $3);
      `;
      await client.query(inventarioQuery, [
        variante.id_variante,
        data.sucursal_id,
        data.stock_inicial ?? 0,
      ]);

      await client.query('COMMIT');
      return variante;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        throw new ConflictError('Ya existe una variante con este código de barras');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: number): Promise<Variante | null> {
    const query = `
      SELECT id_variante, id_producto_maestro, sku_variante, codigo_barras, modelo, color,
             precio_adquisicion, precio_venta_etiqueta, etiqueta_generada, created_at
      FROM variantes
      WHERE id_variante = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  static async findByProductoMaestro(idProductoMaestro: number): Promise<Variante[]> {
    const query = `
      SELECT id_variante, id_producto_maestro, sku_variante, codigo_barras, modelo, color,
             precio_adquisicion, precio_venta_etiqueta, etiqueta_generada, created_at
      FROM variantes
      WHERE id_producto_maestro = $1
      ORDER BY id_variante;
    `;
    const { rows } = await db.query(query, [idProductoMaestro]);
    return rows;
  }

  static async update(id: number, data: UpdateVarianteInput): Promise<Variante> {
    const campos: string[] = [];
    const valores: unknown[] = [];
    let paramIndex = 1;

    if (data.codigo_barras !== undefined) {
      campos.push(`codigo_barras = $${paramIndex++}`);
      valores.push(data.codigo_barras);
    }
    if (data.modelo !== undefined) {
      campos.push(`modelo = $${paramIndex++}`);
      valores.push(data.modelo);
    }
    if (data.color !== undefined) {
      campos.push(`color = $${paramIndex++}`);
      valores.push(data.color);
    }
    if (data.precio_adquisicion !== undefined) {
      campos.push(`precio_adquisicion = $${paramIndex++}`);
      valores.push(data.precio_adquisicion);
    }
    if (data.precio_venta_etiqueta !== undefined) {
      campos.push(`precio_venta_etiqueta = $${paramIndex++}`);
      valores.push(data.precio_venta_etiqueta);
    }

    if (campos.length === 0) {
      throw new ValidationError('No se proporcionaron campos para actualizar');
    }

    valores.push(id);
    const query = `
      UPDATE variantes
      SET ${campos.join(', ')}
      WHERE id_variante = $${paramIndex}
      RETURNING id_variante, id_producto_maestro, sku_variante, codigo_barras, modelo, color,
                precio_adquisicion, precio_venta_etiqueta, etiqueta_generada, created_at;
    `;

    try {
      const { rows } = await db.query(query, valores);
      if (rows.length === 0) {
        throw new NotFoundError('Variante no encontrada');
      }
      return rows[0];
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        throw new ConflictError('Ya existe una variante con este código de barras');
      }
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    const existeQuery = `SELECT id_variante FROM variantes WHERE id_variante = $1;`;
    const { rows: varianteRows } = await db.query(existeQuery, [id]);
    if (varianteRows.length === 0) {
      throw new NotFoundError('Variante no encontrada');
    }

    const stockQuery = `
      SELECT id_inventario FROM inventario_sucursal
      WHERE id_variante = $1 AND stock_actual > 0
      LIMIT 1;
    `;
    const { rows: stockRows } = await db.query(stockQuery, [id]);
    if (stockRows.length > 0) {
      throw new ConflictError('No se puede eliminar: la variante tiene stock activo en una o más sucursales');
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM inventario_sucursal WHERE id_variante = $1;`, [id]);
      await client.query(`DELETE FROM variantes WHERE id_variante = $1;`, [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}