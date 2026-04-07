import { z } from 'zod';

const passwordRules = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'La contraseña debe incluir al menos un carácter especial');

export const loginSchema = z.object({
  email: z.string().email('El formato del correo es inválido'),
  password: passwordRules,
});

export const verifyOtpSchema = z.object({
  preToken: z.string().min(1, 'Token de pre-autenticación requerido'),
  code: z.string().length(6, 'El código debe tener 6 dígitos').regex(/^\d{6}$/, 'El código debe ser numérico'),
});

export const registrarUsuarioSchema = z.object({
  nombre: z.string().min(2, 'El nombre es muy corto').max(100, 'El nombre es muy largo'),
  email: z.string().email('El formato del correo es inválido').max(150),
  password: passwordRules,
  rol: z.enum(['ADMIN', 'GERENTE'], {
    error: 'Rol inválido. Debe ser ADMIN o GERENTE'
  }),
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type VerifyOtpDTO = z.infer<typeof verifyOtpSchema>;
export type RegistrarUsuarioDTO = z.infer<typeof registrarUsuarioSchema>;