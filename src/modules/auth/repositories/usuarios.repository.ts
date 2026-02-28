import { db } from '@/lib/db/client';
import { Usuario, UsuarioSinPassword } from '../types/auth.types';
import { ConflictError } from '@/lib/errors/app-error';

export class UsuariosRepository {
  
  static async findByEmail(email: string): Promise<Usuario | null> {
    const query = `
      SELECT id_usuario, nombre, email, password_hash, rol, activo, created_at 
      FROM usuarios 
      WHERE email = $1;
    `;
    const { rows } = await db.query(query, [email]);
    return rows[0] || null;
  }

  // Extraemos datos sin incluir password_hash (contraseña del usuario)
  static async findById(id: number): Promise<UsuarioSinPassword | null> {
    const query = `
      SELECT id_usuario, nombre, email, rol, activo, created_at 
      FROM usuarios 
      WHERE id_usuario = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  static async create(
    nombre: string, 
    email: string, 
    passwordHash: string, 
    rol: string
  ): Promise<UsuarioSinPassword> {
    const query = `
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES ($1, $2, $3, $4)
      RETURNING id_usuario, nombre, email, rol, activo, created_at;
    `;
    try {
      const { rows } = await db.query(query, [nombre, email, passwordHash, rol]);
      return rows[0];
    } catch (error: unknown) {
      // 23505 = unique_violation en PostgreSQL (email duplicado)
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
        throw new ConflictError('Ya existe un usuario con este email');
      }
      throw error;
    }
  }
}