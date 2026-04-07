import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('El formato del correo es inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const registrarUsuarioSchema = z.object({
  nombre: z.string().min(2, 'El nombre es muy corto').max(100, 'El nombre es muy largo'),
  email: z.string().email('El formato del correo es inválido').max(150),
  password: z.string().min(8, 'Por seguridad, la contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(['ADMIN', 'GERENTE'], {
    error: 'Rol inválido. Debe ser ADMIN o GERENTE'
  }),
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegistrarUsuarioDTO = z.infer<typeof registrarUsuarioSchema>;