export interface Usuario {
  id_usuario: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: 'ADMIN' | 'GERENTE';
  activo: boolean;
  created_at: Date;
  totp_secret: string | null;
  totp_enabled: boolean;
}

export type UsuarioSinPassword = Omit<Usuario, 'password_hash' | 'totp_secret'>;

export interface JWTPayload {
  userId: number;
  email: string;
  rol: 'ADMIN' | 'GERENTE';
}

export interface PreAuthPayload {
  userId: number;
  email: string;
  pre: true;
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioSinPassword;
}

export interface PreAuthResponse {
  preToken: string;
  requires2fa: true;
  isNewSetup: boolean;
  qrDataUrl?: string;
}