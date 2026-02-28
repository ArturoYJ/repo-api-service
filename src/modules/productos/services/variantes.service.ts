import { db } from '@/lib/db/client';
import { VariantesRepository } from '../repositories/variantes.repository';
import {
  Variante,
  CreateVarianteInput,
  UpdateVarianteInput,
} from '../types/variantes.types';
import { AppError, ConflictError, ValidationError } from '@/lib/errors/app-error';

export class VariantesService {

  /**
   * Crea una nueva variante para un producto existente.
   * - Normaliza modelo y color (uppercase, trim)
   * - Valida que precio_venta >= precio_adquisicion
   * - Genera código de barras automático si no se provee
   * - Verifica duplicados (mismo producto + mismo modelo + mismo color)
   */
  static async addVariante(productoId: number, data: Omit<CreateVarianteInput, 'sku_variante'>): Promise<Variante> {
    // 1. Normalización de datos
    const modelo = data.modelo ? data.modelo.trim().toUpperCase() : null;
    const color = data.color ? data.color.trim().toUpperCase() : null;
    const precioAdquisicion = Number(data.precio_adquisicion);
    const precioVenta = Number(data.precio_venta_etiqueta);

    // 2. Validaciones de negocio
    if (precioVenta < precioAdquisicion) {
      throw new ValidationError('El precio de venta no puede ser menor al costo de adquisición');
    }

    // 3. Generación automática de código de barras
    // Formato: PROD-{ID}-VAR-{TIMESTAMP}
    const codigoBarras = data.codigo_barras 
      ? data.codigo_barras.trim()
      : `PROD-${productoId}-${Date.now()}`;

    // 4. Verificar duplicados lógicos (mismo producto, modelo y color)
    // Esto es una regla de negocio adicional a la restricción única de código de barras en BD
    const existentes = await VariantesRepository.findByProductoMaestro(productoId);
    const duplicada = existentes.find(v => 
      (v.modelo === modelo) && (v.color === color)
    );

    if (duplicada) {
      throw new ConflictError('Ya existe una variante con este modelo y color para el producto');
    }

    // 4.5 Obtener producto maestro para derivar el sku_variante
    const { ProductosService } = await import('./productos.service'); // Import dinámico para evitar dependencias circulares si aplican
    const productoMaestro = await ProductosService.getProductoById(productoId);
    const skuVariante = ProductosService.generarSkuVariante(productoMaestro.sku, color, modelo);

    // 5. Persistir usando el repository
    const nuevaVariante: CreateVarianteInput & { sku_variante: string } = {
      ...data,
      sku_variante: skuVariante,
      codigo_barras: codigoBarras,
      modelo,
      color,
      precio_adquisicion: precioAdquisicion,
      precio_venta_etiqueta: precioVenta,
    };

    return await VariantesRepository.create(productoId, nuevaVariante);
  }

  /**
   * Actualiza una variante existente.
   * - Valida precios si ambos son provistos o si se actualiza uno solo
   */
  static async updateVariante(id: number, data: UpdateVarianteInput): Promise<Variante> {
    const varianteActual = await VariantesRepository.findById(id);
    if (!varianteActual) {
      throw new ValidationError('Variante no encontrada');
    }

    // Calcular nuevos valores (usar el nuevo si viene, sino mantener el actual)
    const nuevoCosto = data.precio_adquisicion !== undefined 
      ? Number(data.precio_adquisicion) 
      : Number(varianteActual.precio_adquisicion);
      
    const nuevoPrecio = data.precio_venta_etiqueta !== undefined 
      ? Number(data.precio_venta_etiqueta) 
      : Number(varianteActual.precio_venta_etiqueta);

    if (nuevoPrecio < nuevoCosto) {
      throw new ValidationError('El precio de venta no puede ser menor al costo de adquisición');
    }

    // Normalizar textos si vienen
    const updateData: UpdateVarianteInput = { ...data };
    if (data.modelo !== undefined) updateData.modelo = data.modelo?.trim().toUpperCase() ?? null;
    if (data.color !== undefined) updateData.color = data.color?.trim().toUpperCase() ?? null;
    if (data.codigo_barras !== undefined) updateData.codigo_barras = data.codigo_barras.trim();
    if (data.sku_variante !== undefined) updateData.sku_variante = data.sku_variante.trim();

    return await VariantesRepository.update(id, updateData);
  }

  /**
   * Elimina una variante.
   * La validación de inventario ya la hace el repository.
   */
  static async deleteVariante(id: number): Promise<void> {
    await VariantesRepository.delete(id);
  }
}
