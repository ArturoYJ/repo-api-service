export interface EstadisticasGenerales {
  total_productos_unicos: number;
  total_variantes: number;
  valor_total_inventario: number;
}

export interface ProductosPorSucursal {
  id_sucursal: number;
  nombre_sucursal: string;
  total_productos: number;
}

export interface UtilidadesNetas {
  total_ventas: number;
  ingresos_brutos: number;
  costo_total: number;
  utilidad_neta: number;
}

/** Usar RankingProducto en su lugar */
export interface TopProducto {
  id_producto_maestro: number;
  sku: string;
  nombre: string;
  modelo: string | null;
  color: string | null;
  total_vendido: number;
  ingresos: number;
}

/** Resultado de vista_ranking_productos_global */
export interface RankingProducto {
  id_producto_maestro: number;
  sku: string;
  nombre_producto: string;
  id_variante: number;
  sku_variante: string;
  modelo: string | null;
  color: string | null;
  precio_adquisicion: number;
  precio_venta_etiqueta: number;
  total_unidades_vendidas: number;
  ingresos_totales: number;
  utilidad_total: number;
  ranking_mas_vendido: number;
  ranking_menos_vendido: number;
}

/** Resultado de vista_ranking_productos_por_sucursal */
export interface RankingProductoSucursal extends RankingProducto {
  id_sucursal: number;
  nombre_sucursal: string;
  ingresos_sucursal: number;
  utilidad_sucursal: number;
}

/** Resultado de vista_resumen_ventas_por_sucursal */
export interface ResumenVentasSucursal {
  id_sucursal: number;
  nombre_sucursal: string;
  total_transacciones: number;
  total_unidades_vendidas: number;
  ingresos_brutos: number;
  costo_total: number;
  utilidad_neta: number;
}

export interface FiltrosDashboard {
  fecha_inicio?: Date;
  fecha_fin?: Date;
  top_limit?: number;
}

export interface VentasPorDia {
  fecha: string;
  total_ventas: number;
  ingresos_brutos: number;
  utilidad_neta: number;
}

export interface DashboardCompleto {
  estadisticas: EstadisticasGenerales;
  productos_por_sucursal: ProductosPorSucursal[];
  utilidades: UtilidadesNetas;
  top_productos: RankingProducto[];
  slow_movers: RankingProducto[];
  rendimiento_sucursales: ResumenVentasSucursal[];
  ventas_por_dia: VentasPorDia[];
}
