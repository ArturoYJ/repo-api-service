export interface Usuario {
  id_usuario: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: 'ADMIN' | 'GERENTE';
  activo: boolean;
  created_at: Date;
}

export type UsuarioSinPassword = Omit<Usuario, 'password_hash'>;

export interface JWTPayload {
  userId: number;
  email: string;
  rol: 'ADMIN' | 'GERENTE';
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioSinPassword;
}