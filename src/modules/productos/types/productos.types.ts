import { Variante, CreateVarianteInput } from './variantes.types';

export interface ProductoMaestro {
  id_producto_maestro: number;
  sku: string;
  nombre: string;
  proveedor: string | null;
  created_at: Date;
}

export interface ProductoConVariantes extends ProductoMaestro {
  variantes: Variante[];
}

export interface CreateProductoInput {
  sku?: string;
  nombre: string;
}

export interface UpdateProductoInput {
  sku?: string;
  nombre?: string;
}

export interface CreateProductoCompletoInput {
  sku?: string;
  nombre: string;
  variantes?: CreateVarianteInput[];
}

export * from './pagination.types';