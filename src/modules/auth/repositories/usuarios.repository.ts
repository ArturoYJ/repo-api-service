import { db } from '@/lib/db/client';
import { Usuario, UsuarioSinPassword } from '../types/auth.types';
import { ConflictError } from '@/lib/errors/app-error';

export class UsuariosRepository {

  static async findByEmail(email: string): Promise<Usuario | null> {
    const { rows } = await db.query(
      `SELECT id_usuario, nombre, email, password_hash, rol, activo, created_at, totp_secret, totp_enabled
       FROM usuarios WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  }

  static async findById(id: number): Promise<UsuarioSinPassword | null> {
    const { rows } = await db.query(
      `SELECT id_usuario, nombre, email, rol, activo, created_at, totp_enabled
       FROM usuarios WHERE id_usuario = $1`,
      [id]
    );
    return rows[0] || null;
  }

  static async saveTotpSecret(userId: number, secret: string): Promise<void> {
    await db.query(
      `UPDATE usuarios SET totp_secret = $1, totp_enabled = false WHERE id_usuario = $2`,
      [secret, userId]
    );
  }

  static async enableTotp(userId: number): Promise<void> {
    await db.query(
      `UPDATE usuarios SET totp_enabled = true WHERE id_usuario = $1`,
      [userId]
    );
  }

  static async create(
    nombre: string,
    email: string,
    passwordHash: string,
    rol: string
  ): Promise<UsuarioSinPassword> {
    try {
      const { rows } = await db.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol)
         VALUES ($1, $2, $3, $4)
         RETURNING id_usuario, nombre, email, rol, activo, created_at, totp_enabled`,
        [nombre, email, passwordHash, rol]
      );
      return rows[0];
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        throw new ConflictError('Ya existe un usuario con este email');
      }
      throw error;
    }
  }
}