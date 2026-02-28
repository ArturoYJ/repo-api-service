import { db } from '@/lib/db/client';
import { ProductosRepository } from '../repositories/productos.repository';
import {
  ProductoMaestro,
  ProductoConVariantes,
  CreateProductoCompletoInput,
  UpdateProductoInput,
  PaginatedProductResponse,
} from '../types/productos.types';
import { Variante, CreateVarianteInput } from '../types/variantes.types';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors/app-error';
import { crearProductoMaestroSchema } from '../schemas/producto.schema';

export class ProductosService {

  /**
   * Crea un producto maestro con todas sus variantes en transacción.
   * - Valida schema Zod
   * - Normaliza textos
   * - Valida reglas de precios (venta >= costo)
   * - Marca etiqueta_generada = true
   */
  static async createProductoCompleto(data: CreateProductoCompletoInput): Promise<ProductoConVariantes> {
    // 1. Validar Schema Zod
    const validation = crearProductoMaestroSchema.safeParse(data);
    if (!validation.success) {
      throw new ValidationError(validation.error.issues.map(i => i.message).join(', '));
    }

    const parsedData = validation.data;

    // 2. Normalización y Reglas de Negocio
    const variantesNormalizadas = (parsedData.variantes || []).map(v => {
      // Regla: Precio venta >= Precio costo
      if (v.precio_venta_etiqueta < v.precio_adquisicion) {
        throw new ValidationError(`El precio de venta no puede ser menor al costo en la variante ${v.codigo_barras || ''}`);
      }

      return {
        ...v,
        modelo: v.modelo ? v.modelo.trim().toUpperCase() : null,
        color: v.color ? v.color.trim().toUpperCase() : null,
        codigo_barras: v.codigo_barras
          ? v.codigo_barras.trim()
          : `CB-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        etiqueta_generada: true,
      };
    });

    const productoNormalizado: CreateProductoCompletoInput = {
      ...parsedData,
      nombre: parsedData.nombre.trim(),
      sku: parsedData.sku ? parsedData.sku.trim().toUpperCase() : undefined, // GenerarSku lo hace si es undefined
      variantes: variantesNormalizadas as unknown as CreateVarianteInput[],
    };

    // 3. Persistencia Transaccional (Lógica movida al Service anteriormente)
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 3.1 Crear Producto
      const sku = productoNormalizado.sku || ProductosService.generarSkuBase(productoNormalizado.nombre);
      const productoQuery = `
        INSERT INTO productos_maestros (sku, nombre)
        VALUES ($1, $2)
        RETURNING id_producto_maestro, sku, nombre, created_at;
      `;
      const { rows: productoRows } = await client.query(productoQuery, [sku, productoNormalizado.nombre]);
      const producto: ProductoMaestro = productoRows[0];

      // 3.2 Crear Variantes
      const variantes: Variante[] = [];
      const varianteQuery = `
        INSERT INTO variantes (id_producto_maestro, sku_variante, codigo_barras, modelo, color, precio_adquisicion, precio_venta_etiqueta, etiqueta_generada)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id_variante, id_producto_maestro, sku_variante, codigo_barras, modelo, color, 
                  precio_adquisicion, precio_venta_etiqueta, etiqueta_generada, created_at;
      `;

      for (const v of variantesNormalizadas) {
        const skuVariante = ProductosService.generarSkuVariante(producto.sku, v.color, v.modelo);
        
        const { rows: varianteRows } = await client.query(varianteQuery, [
          producto.id_producto_maestro,
          skuVariante,
          v.codigo_barras,
          v.modelo ?? null,
          v.color ?? null,
          v.precio_adquisicion,
          v.precio_venta_etiqueta,
          true, // etiqueta_generada hardcodeada a true
        ]);
        const variante = varianteRows[0]; 
        variantes.push(variante);

      await client.query(
          `INSERT INTO inventario_sucursal (id_variante, id_sucursal, stock_actual)
           VALUES ($1, $2, $3)`,
          [variante.id_variante, v.sucursal_id, v.stock_inicial ?? 0]
        );
      }

      await client.query('COMMIT');
      return { ...producto, variantes };

    } catch (error: unknown) {
      await client.query('ROLLBACK');
      
      // Manejo de duplicados (SKU o Código de Barras)
      if (error instanceof Error && 'code' in error) {
        const pgCode = (error as { code: string }).code;
        if (pgCode === '23505') {
          const detail = 'detail' in error ? (error as { detail: string }).detail : '';
          if (detail.includes('sku')) throw new ConflictError('El SKU ya existe en el sistema.');
          if (detail.includes('codigo_barras')) throw new ConflictError('El código de barras ya existe en otra variante.');
          throw new ConflictError('Registro duplicado detectado.');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene todos los productos con paginación opcional.
   */
  static async getAllProductos(page: number = 1, limit: number = 10): Promise<PaginatedProductResponse> {
    const offset = (page - 1) * limit;

    // 1. Obtener total para paginación
    const countQuery = `SELECT COUNT(*) FROM productos_maestros`;
    const { rows: countRows } = await db.query(countQuery);
    const total = Number(countRows[0].count);

    // 2. Obtener productos paginados (solo IDs para luego hacer JOIN)
    const idsQuery = `
      SELECT id_producto_maestro 
      FROM productos_maestros 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const { rows: idsRows } = await db.query(idsQuery, [limit, offset]);
    
    if (idsRows.length === 0) {
      return { productos: [], total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const ids = idsRows.map(r => r.id_producto_maestro).join(',');

    // 3. Obtener datos completos con variantes para esos IDs
    const productosQuery = `
      SELECT 
        pm.id_producto_maestro, pm.sku, pm.nombre, pm.created_at,
        v.id_variante, v.sku_variante, v.codigo_barras, v.modelo, v.color,
        v.precio_adquisicion, v.precio_venta_etiqueta,
        v.etiqueta_generada, v.created_at AS variante_created_at,
        s.nombre_lugar AS sucursal
      FROM productos_maestros pm
      LEFT JOIN variantes v ON pm.id_producto_maestro = v.id_producto_maestro
      LEFT JOIN inventario_sucursal inv ON v.id_variante = inv.id_variante
      LEFT JOIN sucursales s ON inv.id_sucursal = s.id_sucursal
      WHERE pm.id_producto_maestro IN (${ids})
      ORDER BY pm.created_at DESC, v.id_variante ASC
    `;
    
    const { rows } = await db.query(productosQuery);
    const productos = ProductosRepository.agruparProductosConVariantes(rows); // Reutilizamos helper estático (ahora público/internal)

    return {
      productos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getProductoById(id: number): Promise<ProductoConVariantes> {
    const producto = await ProductosRepository.findById(id);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }
    return producto;
  }

  static async updateProducto(id: number, data: UpdateProductoInput): Promise<ProductoMaestro> {
    const updateData = { ...data };
    
    if (updateData.sku) {
      updateData.sku = updateData.sku.trim().toUpperCase();
      if (updateData.sku.length < 3) {
         throw new ValidationError('El SKU debe tener al menos 3 caracteres');
      }
    }
    
    if (updateData.nombre) {
      updateData.nombre = updateData.nombre.trim();
      if (updateData.nombre.length < 2) {
        throw new ValidationError('El nombre debe tener al menos 2 caracteres');
      }
    }

    return await ProductosRepository.update(id, updateData);
  }

  static async deleteProducto(id: number): Promise<void> {
    // La validación de dependencias (inventario) ya está en el repositorio
    await ProductosRepository.delete(id);
  }

  /**
   * Genera SKU base del producto maestro (ej: ZAP-1740269100000)
   */
  static generarSkuBase(nombre: string): string {
    const prefijo = nombre
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 3);
    const timestamp = Date.now();
    return `${prefijo}-${timestamp}`;
  }

  /**
   * Genera SKU de la variante derivado del SKU base (ej: ZAP-1740269100000-NEG-MOD01)
   */
  static generarSkuVariante(skuBase: string, color?: string | null, modelo?: string | null): string {
    const colorPart = color
      ? color.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3)
      : 'XXX';
    const modelPart = modelo
      ? modelo.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5)
      : 'GEN';
    return `${skuBase}-${colorPart}-${modelPart}`;
  }
}
