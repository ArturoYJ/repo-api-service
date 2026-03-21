export interface Variante {
  id_variante: number;
  id_producto_maestro: number;
  sku_variante: string;
  codigo_barras?: string;
  modelo?: string | null;
  color: string | null;
  precio_adquisicion: number;
  precio_venta_etiqueta: number;
  etiqueta_generada: boolean;
  fecha_compra?: string | null;
  created_at: Date;
  sucursal?: string | null;
}

export interface CreateVarianteInput {
  sku_variante?: string;
  codigo_barras?: string;
  modelo?: string | null;
  color?: string | null;
  precio_adquisicion: number;
  precio_venta_etiqueta: number;
  sucursal_id: number;
  stock_inicial?: number;
  fecha_compra?: string | null;
}

export interface UpdateVarianteInput {
  sku_variante?: string;
  codigo_barras?: string;
  modelo?: string | null;
  color?: string | null;
  precio_adquisicion?: number;
  precio_venta_etiqueta?: number;
  fecha_compra?: string | null;
}

export interface VarianteInfo {
  nombre: string;
  sku: string;
  codigo_barras: string | null;
  modelo: string | null;
  color: string | null;
  precio_adquisicion: number;
  precio_venta_etiqueta: number;
  stock: number;
}