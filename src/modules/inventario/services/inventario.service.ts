import { db } from '@/lib/db/client';
import { InventarioRepository } from '../repositories/inventario.repository';
import {
  InventarioConValor,
  RegistrarBajaInput,
  AjustarInventarioInput,
  BajaRegistrada,
} from '../types/inventario.types';
import { ValidationError, NotFoundError } from '@/lib/errors/app-error';

interface AjustePorCantidadInput {
  id_variante: number;
  id_sucursal: number;
  cantidad: number; // positivo = entrada, negativo = salida
  motivo: string;
  id_usuario: number;
}

export class InventarioService {

  static async getInventarioBySucursal(id_sucursal: number): Promise<InventarioConValor[]> {
    const inventario = await InventarioRepository.findBySucursal(id_sucursal);
    return inventario.map((item) => ({
      ...item,
      valor_total: item.stock_actual * Number(item.precio_venta),
    }));
  }

  static async validateStockDisponible(
    id_variante: number,
    id_sucursal: number,
    cantidad_requerida: number
  ): Promise<boolean> {
    return InventarioRepository.checkStock(id_variante, id_sucursal, cantidad_requerida);
  }

  static async registrarBaja(data: RegistrarBajaInput): Promise<BajaRegistrada> {
    const hayStock = await InventarioRepository.checkStock(
      data.id_variante,
      data.id_sucursal,
      data.cantidad
    );

    if (!hayStock) {
      const stockActual = await InventarioRepository.getStockActual(
        data.id_variante,
        data.id_sucursal
      );
      throw new ValidationError(
        `Stock insuficiente. Disponible: ${stockActual}, Solicitado: ${data.cantidad}`
      );
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE inventario_sucursal
        SET stock_actual = stock_actual - $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_variante = $2 AND id_sucursal = $3
        RETURNING stock_actual;
      `;
      const { rows: stockRows } = await client.query(updateQuery, [
        data.cantidad,
        data.id_variante,
        data.id_sucursal,
      ]);

      const transaccionQuery = `
        INSERT INTO ventas_bajas (id_variante, id_sucursal, id_motivo, id_usuario, cantidad, precio_venta_final)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id_transaccion;
      `;
      const { rows: transRows } = await client.query(transaccionQuery, [
        data.id_variante,
        data.id_sucursal,
        data.id_motivo,
        data.id_usuario,
        data.cantidad,
        data.precio_venta_final,
      ]);

      await client.query('COMMIT');

      return {
        id_transaccion: transRows[0].id_transaccion,
        stock_resultante: stockRows[0].stock_actual,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async ajustarInventario(data: AjustarInventarioInput): Promise<BajaRegistrada> {
    if (data.cantidad_nueva < 0) {
      throw new ValidationError('La cantidad de ajuste no puede ser negativa');
    }

    const registroActual = await InventarioRepository.findByVarianteAndSucursal(
      data.id_variante,
      data.id_sucursal
    );

    if (!registroActual) {
      throw new NotFoundError('No existe registro de inventario para esta variante en la sucursal');
    }

    const diferencia = data.cantidad_nueva - registroActual.stock_actual;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE inventario_sucursal
        SET stock_actual = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_variante = $2 AND id_sucursal = $3
        RETURNING stock_actual;
      `;
      await client.query(updateQuery, [
        data.cantidad_nueva,
        data.id_variante,
        data.id_sucursal,
      ]);

      const transaccionQuery = `
        INSERT INTO ventas_bajas (id_variante, id_sucursal, id_motivo, id_usuario, cantidad, precio_venta_final)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id_transaccion;
      `;
      const { rows: transRows } = await client.query(transaccionQuery, [
        data.id_variante,
        data.id_sucursal,
        data.id_motivo,
        data.id_usuario,
        Math.abs(diferencia),
        0,
      ]);

      await client.query('COMMIT');

      return {
        id_transaccion: transRows[0].id_transaccion,
        stock_resultante: data.cantidad_nueva,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async executarAjustePorCantidad(data: AjustePorCantidadInput): Promise<{ stock_nuevo: number; id_transaccion: number }> {
    // 1. Buscar id_motivo por descripcion (fuera de la transacción, es solo lectura)
    const motivoQuery = `
      SELECT id_motivo FROM motivos_transaccion WHERE descripcion = $1;
    `;
    const { rows: motivoRows } = await db.query(motivoQuery, [data.motivo]);

    if (motivoRows.length === 0) {
      throw new NotFoundError(`Motivo de transacción no encontrado: "${data.motivo}"`);
    }
    const id_motivo: number = motivoRows[0].id_motivo;

    // 2. Transacción atómica: actualizar stock + registrar auditoría
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 2a. Obtener stock actual con bloqueo de fila (FOR UPDATE) para evitar race conditions
      const checkQuery = `
        SELECT stock_actual
        FROM inventario_sucursal
        WHERE id_variante = $1 AND id_sucursal = $2
        FOR UPDATE;
      `;
      const { rows: stockRows } = await client.query(checkQuery, [data.id_variante, data.id_sucursal]);

      if (stockRows.length === 0) {
        throw new NotFoundError('Registro de inventario no encontrado');
      }

      const currentStock = stockRows[0].stock_actual;
      const newStock = currentStock + data.cantidad;

      if (newStock < 0) {
        throw new ValidationError(
          `Stock insuficiente. Actual: ${currentStock}, Solicitado: ${Math.abs(data.cantidad)}`
        );
      }

      // 2b. Actualizar stock
      const updateQuery = `
        UPDATE inventario_sucursal
        SET stock_actual = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id_variante = $2 AND id_sucursal = $3
        RETURNING stock_actual;
      `;
      const { rows: updatedRows } = await client.query(updateQuery, [newStock, data.id_variante, data.id_sucursal]);

      // 2c. Registrar la operación en ventas_bajas para auditoría
      const cantidadAbsoluta = Math.abs(data.cantidad);
      const transaccionQuery = `
        INSERT INTO ventas_bajas (id_variante, id_sucursal, id_motivo, id_usuario, cantidad, precio_venta_final)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id_transaccion;
      `;
      const { rows: transRows } = await client.query(transaccionQuery, [
        data.id_variante,
        data.id_sucursal,
        id_motivo,
        data.id_usuario,
        cantidadAbsoluta,
        0,
      ]);

      await client.query('COMMIT');

      const tipo = data.cantidad > 0 ? 'ENTRADA' : 'SALIDA';
      console.info(
        `[AUDITORIA] INVENTARIO_${tipo} | variante=${data.id_variante} sucursal=${data.id_sucursal} ` +
        `cantidad=${data.cantidad} motivo="${data.motivo}" usuario=${data.id_usuario} ` +
        `stock_nuevo=${updatedRows[0].stock_actual} transaccion=${transRows[0].id_transaccion}`
      );

      return {
        stock_nuevo: updatedRows[0].stock_actual,
        id_transaccion: transRows[0].id_transaccion,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}