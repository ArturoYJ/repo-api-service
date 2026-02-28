import { db } from '@/lib/db/client';
import { InventarioSucursal, InventarioDetallado, CreateInventarioInput } from '../types/inventario.types';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors/app-error';

export class InventarioRepository {

  // Obtiene el inventario completo de una sucursal con detalles de producto
  static async findBySucursal(id_sucursal: number): Promise<InventarioDetallado[]> {
    const query = `
      SELECT 
        i.id_inventario, i.id_variante, i.id_sucursal, i.stock_actual, i.updated_at,
        v.sku_variante as sku_producto, p.nombre as nombre_producto,
        v.codigo_barras, v.modelo, v.color,
        v.precio_adquisicion,
        v.precio_venta_etiqueta as precio_venta
      FROM inventario_sucursal i
      JOIN variantes v ON i.id_variante = v.id_variante
      JOIN productos_maestros p ON v.id_producto_maestro = p.id_producto_maestro
      WHERE i.id_sucursal = $1
      ORDER BY p.nombre, v.modelo;
    `;
    const { rows } = await db.query(query, [id_sucursal]);
    return rows;
  }

  // Obtiene el registro de inventario específico para una variante en una sucursal
  static async findByVarianteAndSucursal(id_variante: number, id_sucursal: number): Promise<InventarioSucursal | null> {
    const query = `
      SELECT id_inventario, id_variante, id_sucursal, stock_actual, updated_at
      FROM inventario_sucursal
      WHERE id_variante = $1 AND id_sucursal = $2;
    `;
    const { rows } = await db.query(query, [id_variante, id_sucursal]);
    return rows[0] || null;
  }

  // Crea un registro de inventario inicial para una variante en una sucursal
  static async create(data: CreateInventarioInput): Promise<InventarioSucursal> {
    const query = `
      INSERT INTO inventario_sucursal (id_variante, id_sucursal, stock_actual)
      VALUES ($1, $2, $3)
      RETURNING id_inventario, id_variante, id_sucursal, stock_actual, updated_at;
    `;
    try {
      const { rows } = await db.query(query, [data.id_variante, data.id_sucursal, data.stock_actual]);
      return rows[0];
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        throw new ConflictError('Ya existe inventario para esta variante en la sucursal');
      }
      throw error;
    }
  }

  // Actualiza el stock sumando o restando la cantidad proporcionada
  // Valida que el stock resultante no sea negativo
  static async updateStock(id_variante: number, id_sucursal: number, cantidad: number): Promise<InventarioSucursal> {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Obtener stock actual con bloqueo fila para evitar condiciones de carrera
      const checkQuery = `
        SELECT stock_actual 
        FROM inventario_sucursal 
        WHERE id_variante = $1 AND id_sucursal = $2
        FOR UPDATE;
      `;
      const { rows } = await client.query(checkQuery, [id_variante, id_sucursal]);

      if (rows.length === 0) {
        throw new NotFoundError('Registro de inventario no encontrado');
      }

      const currentStock = rows[0].stock_actual;
      const newStock = currentStock + cantidad;

      if (newStock < 0) {
        throw new ValidationError(`Stock insuficiente. Actual: ${currentStock}, Solicitado: ${Math.abs(cantidad)}`);
      }

      // 2. Actualizar stock
      const updateQuery = `
        UPDATE inventario_sucursal
        SET stock_actual = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_variante = $2 AND id_sucursal = $3
        RETURNING id_inventario, id_variante, id_sucursal, stock_actual, updated_at;
      `;
      const { rows: updatedRows } = await client.query(updateQuery, [newStock, id_variante, id_sucursal]); // Corrected values array
      
      await client.query('COMMIT');
      return updatedRows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Verifica si hay suficiente stock para una operación
  static async checkStock(id_variante: number, id_sucursal: number, cantidad: number): Promise<boolean> {
    const query = `
      SELECT stock_actual 
      FROM inventario_sucursal 
      WHERE id_variante = $1 AND id_sucursal = $2;
    `;
    const { rows } = await db.query(query, [id_variante, id_sucursal]);
    
    if (rows.length === 0) return false;
    return rows[0].stock_actual >= cantidad;
  }

  // Obtiene la cantidad actual de stock
  static async getStockActual(id_variante: number, id_sucursal: number): Promise<number> {
    const query = `
      SELECT stock_actual 
      FROM inventario_sucursal 
      WHERE id_variante = $1 AND id_sucursal = $2;
    `;
    const { rows } = await db.query(query, [id_variante, id_sucursal]);
    
    if (rows.length === 0) {
        // Podríamos considerar que si no existe registro, el stock es 0, o lanzar error.
        // Dado que es un módulo de inventario estricto, mejor retornar 0 si no existe fila,
        // pero validando primero si la variante/sucursal existen es costoso. 
        // Asumiremos 0.
        return 0;
    }
    return rows[0].stock_actual;
  }

  static async findAllMotivos(): Promise<{ id_motivo: number; descripcion: string }[]> {
    const { rows } = await db.query(
      'SELECT id_motivo, descripcion FROM motivos_transaccion ORDER BY id_motivo;'
    );
    return rows;
  }

  static async findMotivoPorDescripcion(descripcion: string): Promise<number | null> {
    const { rows } = await db.query(
      'SELECT id_motivo FROM motivos_transaccion WHERE descripcion = $1;',
      [descripcion]
    );
    return rows[0]?.id_motivo ?? null;
  }

  static async findById(id_inventario: number): Promise<InventarioSucursal | null> {
  const query = `
    SELECT id_inventario, id_variante, id_sucursal, stock_actual, updated_at
    FROM inventario_sucursal
    WHERE id_inventario = $1;
  `;
  const { rows } = await db.query(query, [id_inventario]);
  return rows[0] || null;
}

static async updateStockById(id_inventario: number, stock_actual: number): Promise<InventarioSucursal | null> {
  const query = `
    UPDATE inventario_sucursal
    SET stock_actual = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id_inventario = $2
    RETURNING id_inventario, id_variante, id_sucursal, stock_actual, updated_at;
  `;
  const { rows } = await db.query(query, [stock_actual, id_inventario]);
  return rows[0] || null;
}
  
}

