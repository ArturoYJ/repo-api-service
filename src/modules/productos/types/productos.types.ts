import { Variante, CreateVarianteInput } from './variantes.types';

export interface ProductoMaestro {
  id_producto_maestro: number;
  sku: string;
  nombre: string;
  created_at: Date;
}

export interface ProductoConVariantes extends ProductoMaestro {
  variantes: Variante[];
}

// DTOs de entrada
export interface CreateProductoInput {
  sku?: string;
  nombre: string;
}
// DTO para actualizar producto
export interface UpdateProductoInput {
  sku?: string;
  nombre?: string;
}

// DTO para crear producto completo con variantes en una transacción
export interface CreateProductoCompletoInput {
  sku?: string;
  nombre: string;
  variantes?: CreateVarianteInput[];
}

export * from './pagination.types';
