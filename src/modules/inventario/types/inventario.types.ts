export interface InventarioSucursal {
  id_inventario: number;
  id_variante: number;
  id_sucursal: number;
  stock_actual: number;
  updated_at: Date;
}

export interface InventarioDetallado extends InventarioSucursal {
  sku_producto: string;
  nombre_producto: string;
  codigo_barras: string;
  modelo: string | null;
  color: string | null;
  precio_venta: number;
}

export interface CreateInventarioInput {
  id_variante: number;
  id_sucursal: number;
  stock_actual: number;
}

export interface RegistrarBajaInput {
  id_variante: number;
  id_sucursal: number;
  id_motivo: number;
  id_usuario: number;
  cantidad: number;
  precio_venta_final: number;
}

export interface AjustarInventarioInput {
  id_variante: number;
  id_sucursal: number;
  id_motivo: number;
  id_usuario: number;
  cantidad_nueva: number;
}

export interface InventarioConValor extends InventarioDetallado {
  valor_total: number;
}

export interface BajaRegistrada {
  id_transaccion: number;
  stock_resultante: number;
}

export interface InventarioItem {
  id_inventario: number;
  id_variante: number;
  id_sucursal: number;
  stock_actual: number;
  sku_producto: string;
  nombre_producto: string;
  codigo_barras: string;
  modelo: string | null;
  color: string | null;
  precio_venta: number;
  precio_adquisicion?: number;
  valor_total: number;
}