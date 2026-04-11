import { z } from 'zod';

const passwordRules = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    'La contraseña debe incluir al menos un carácter especial'
  );

export const loginSchema = z.object({
  email: z.string().email('El formato del correo es inválido'),
  password: passwordRules,
});

export const verifyTotpSchema = z.object({
  code: z.string().length(6, 'El código debe tener 6 dígitos').regex(/^\d{6}$/, 'El código debe ser numérico'),
});

export const registrarUsuarioSchema = z.object({
  nombre: z.string().min(2, 'El nombre es muy corto').max(100, 'El nombre es muy largo'),
  email: z.string().email('El formato del correo es inválido').max(150),
  password: passwordRules,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('El formato del correo es inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: passwordRules,
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type VerifyTotpDTO = z.infer<typeof verifyTotpSchema>;
export type RegistrarUsuarioDTO = z.infer<typeof registrarUsuarioSchema>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;