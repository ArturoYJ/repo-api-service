import { DashboardRepository } from '../repositories/dashboard.repository';
import {
  DashboardCompleto,
  EstadisticasGenerales,
  ProductosPorSucursal,
  UtilidadesNetas,
  RankingProducto,
  RankingProductoSucursal,
  ResumenVentasSucursal,
  FiltrosDashboard,
  VentasPorDia,
} from '../types/dashboard.types';

export class DashboardService {

  /**
   * Obtiene las estadísticas generales del sistema:
   * total de productos únicos, variantes y valor total de inventario.
   */
  static async getEstadisticasGenerales(): Promise<EstadisticasGenerales> {
    return DashboardRepository.getEstadisticasGenerales();
  }

  /**
   * Obtiene la cantidad de productos (variantes con stock) por cada sucursal activa.
   */
  static async getProductosPorSucursal(): Promise<ProductosPorSucursal[]> {
    return DashboardRepository.getProductosPorSucursal();
  }

  /**
   * Calcula las utilidades netas del negocio.
   * Si se proporcionan fechas, filtra por ese período; de lo contrario retorna todo el histórico.
   */
  static async getUtilidadesNetas(fechaInicio?: Date, fechaFin?: Date): Promise<UtilidadesNetas> {
    return DashboardRepository.getUtilidadesNetas(fechaInicio, fechaFin);
  }

  // ===== Ranking de productos (via vistas materializadas) =====

  /**
   * Productos más vendidos en TODAS las sucursales.
   */
  static async getMasVendidosGlobal(limit: number = 10, fechaInicio?: Date, fechaFin?: Date): Promise<RankingProducto[]> {
    return DashboardRepository.getMasVendidosGlobal(limit, fechaInicio, fechaFin);
  }

  /**
   * Productos menos vendidos en TODAS las sucursales.
   * Incluye variantes con 0 ventas para detectar producto sin rotación.
   */
  static async getMenosVendidosGlobal(limit: number = 10, fechaInicio?: Date, fechaFin?: Date): Promise<RankingProducto[]> {
    return DashboardRepository.getMenosVendidosGlobal(limit, fechaInicio, fechaFin);
  }

  /**
   * Productos más vendidos en una sucursal específica.
   */
  static async getMasVendidosPorSucursal(id_sucursal: number, limit: number = 10): Promise<RankingProductoSucursal[]> {
    return DashboardRepository.getMasVendidosPorSucursal(id_sucursal, limit);
  }

  /**
   * Productos menos vendidos en una sucursal específica.
   */
  static async getMenosVendidosPorSucursal(id_sucursal: number, limit: number = 10): Promise<RankingProductoSucursal[]> {
    return DashboardRepository.getMenosVendidosPorSucursal(id_sucursal, limit);
  }

  /**
   * KPIs de ventas (transacciones, ingresos, utilidad) por sucursal.
   * Fuente: vista_resumen_ventas_por_sucursal.
   */
  static async getResumenVentasPorSucursal(fechaInicio?: Date, fechaFin?: Date): Promise<ResumenVentasSucursal[]> {
    return DashboardRepository.getResumenVentasPorSucursal(fechaInicio, fechaFin);
  }

  /**
   * Obtiene la tendencia de ventas agrupada por día.
   */
  static async getVentasPorDia(fechaInicio?: Date, fechaFin?: Date): Promise<VentasPorDia[]> {
    return DashboardRepository.getVentasPorDia(fechaInicio, fechaFin);
  }

  /**
   * Obtiene todas las métricas del dashboard en una sola llamada.
   * Ejecuta las queries en paralelo con Promise.all para maximizar rendimiento.
   */
  static async getDashboardCompleto(filtros: FiltrosDashboard = {}): Promise<DashboardCompleto> {
    const { fecha_inicio, fecha_fin, top_limit = 10 } = filtros;

    const [estadisticas, productos_por_sucursal, utilidades, top_productos, slow_movers, rendimiento_sucursales, ventas_por_dia] = await Promise.all([
      this.getEstadisticasGenerales(),
      this.getProductosPorSucursal(),
      this.getUtilidadesNetas(fecha_inicio, fecha_fin),
      this.getMasVendidosGlobal(top_limit, fecha_inicio, fecha_fin),
      this.getMenosVendidosGlobal(top_limit, fecha_inicio, fecha_fin),
      this.getResumenVentasPorSucursal(fecha_inicio, fecha_fin),
      this.getVentasPorDia(fecha_inicio, fecha_fin),
    ]);

    return {
      estadisticas,
      productos_por_sucursal,
      utilidades,
      top_productos,
      slow_movers,
      rendimiento_sucursales,
      ventas_por_dia,
    };
  }
}
