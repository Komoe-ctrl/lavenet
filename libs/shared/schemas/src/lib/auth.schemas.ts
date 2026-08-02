import { z } from 'zod';
import { USER_ROLES } from '@lavenet/shared-domain';

// Login accepts either identifier: email or a phone number in E.164 format
// (+225XXXXXXXXXX for Côte d'Ivoire). Registration always requires a phone
// (see registerSchema) per "un téléphone = un compte" (cahier des charges
// §5.1) -- email is an optional second identifier, not a replacement.
const identifierSchema = z.union([z.email(), z.e164()]);

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2),
  phone: z.e164(),
  email: z.email().optional(),
  password: z.string().min(8),
});
export type RegisterInput = z.infer<typeof registerSchema>;

const OTP_CODE_PATTERN = /^\d{6}$/;
export const verifyOtpSchema = z.object({
  code: z.string().regex(OTP_CODE_PATTERN, 'Le code doit contenir 6 chiffres.'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  fullName: z.string().nullable(),
  email: z.email().nullable(),
  phone: z.string(),
  phoneVerified: z.boolean(),
  role: z.enum(USER_ROLES),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// Registration logs the user in immediately (same shape as login) -- an
// unverified phone can browse, just not order (cahier des charges §5.1) --
// plus an optional demo-only field: the raw OTP code, present only when the
// API runs with DEMO_MODE=true (see apps/api/src/config/env.ts). Never
// present otherwise -- verified by a permanent test.
export const registerResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
  demoOtpCode: z.string().optional(),
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const otpResponseSchema = z.object({
  demoOtpCode: z.string().optional(),
});
export type OtpResponse = z.infer<typeof otpResponseSchema>;

export const verifyOtpResponseSchema = z.object({
  user: authUserSchema,
});
export type VerifyOtpResponse = z.infer<typeof verifyOtpResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

// F-AUTH-04: reuses identifierSchema (email or phone) -- the request never
// reveals whether the identifier is registered (same non-enumeration rule
// as login), so it accepts anything shaped like one.
export const passwordResetRequestSchema = z.object({
  identifier: identifierSchema,
});
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

// Always 200 with this shape, whether or not the identifier is registered
// -- demoOtpCode is only ever populated when it was (and DEMO_MODE=true),
// never fabricated for a non-existent account.
export const passwordResetRequestResponseSchema = z.object({
  demoOtpCode: z.string().optional(),
});
export type PasswordResetRequestResponse = z.infer<typeof passwordResetRequestResponseSchema>;

export const passwordResetConfirmSchema = z.object({
  identifier: identifierSchema,
  code: z.string().regex(OTP_CODE_PATTERN, 'Le code doit contenir 6 chiffres.'),
  newPassword: z.string().min(8),
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;

// Logs the user in immediately on success, same shape as loginResponseSchema
// -- they just proved control of the account via the OTP, no reason to make
// them log in again with the password they just set.
export const passwordResetConfirmResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type PasswordResetConfirmResponse = z.infer<typeof passwordResetConfirmResponseSchema>;
