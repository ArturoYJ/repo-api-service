import { ProductoConVariantes } from './productos.types';

export interface PaginatedProductResponse {
  productos: ProductoConVariantes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
