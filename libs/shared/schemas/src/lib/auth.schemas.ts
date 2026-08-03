import { z } from 'zod';
import { USER_ROLES } from '@lavenet/shared-domain';

const PASSWORD_TOO_SHORT = 'Le mot de passe doit contenir au moins 8 caractères.';
const EMAIL_INVALID = 'Email invalide.';

// Shown under every phone field, before any error (F-AUTH-05 bug report) --
// and reused as the rejection message below, so the hint and the error
// never say two different things.
export const CI_PHONE_FORMAT_HINT = 'Format attendu : 07 00 07 00 07';
const CI_PHONE_ERROR = `Numéro invalide. ${CI_PHONE_FORMAT_HINT}`;

// Côte d'Ivoire numbers are 10 digits, always starting with the trunk '0'
// when dialed locally (post-2021 renumbering) -- that's the form "tout le
// monde utilise" (bug report), not the +225 form. Accepts that local form
// (with or without spaces/dots/dashes between groups), the +225 form, and
// the 00225 form; normalizes all of them to the single canonical form the
// database stores, +225 followed by the same 10 local digits (leading 0
// kept -- this app's convention, matching every seeded/existing record,
// not the international convention of dropping the trunk digit).
// +225/00225 inputs are otherwise accepted permissively (any 10 digits
// after the country code, not just those starting with 0) to keep taking
// values that were already valid before this stricter local-format check
// existed.
export function normalizeCiPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s.-]/g, '');
  if (/^0\d{9}$/.test(cleaned)) {
    return `+225${cleaned}`;
  }
  if (/^\+225\d{10}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^00225\d{10}$/.test(cleaned)) {
    return `+225${cleaned.slice(5)}`;
  }
  return null;
}

const ciPhoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeCiPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: CI_PHONE_ERROR });
    return z.NEVER;
  }
  return normalized;
});

const emailFormat = z.email();

// Login accepts either identifier: email or a phone number (any format
// normalizeCiPhone understands -- see above). Registration always requires
// a phone (see registerSchema) per "un téléphone = un compte" (cahier des
// charges §5.1) -- email is an optional second identifier, not a
// replacement.
//
// Not a z.union of the two: zod v4's union error selection doesn't honor a
// union-level `error` override once one branch has its own `.transform` --
// it just surfaces that branch's own issue (e.g. "Email invalide.") even
// when the input was a mistyped phone number, not an attempted email.
// Trying each shape directly keeps the message under our control.
const identifierSchema = z.string().transform((value, ctx) => {
  const email = emailFormat.safeParse(value);
  if (email.success) {
    return email.data;
  }
  const phone = normalizeCiPhone(value);
  if (phone) {
    return phone;
  }
  ctx.addIssue({
    code: 'custom',
    message: 'Identifiant invalide. Saisissez un email ou un numéro de téléphone.',
  });
  return z.NEVER;
});

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(8, PASSWORD_TOO_SHORT),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Le nom complet doit contenir au moins 2 caractères.'),
  phone: ciPhoneSchema,
  email: z.email(EMAIL_INVALID).optional(),
  password: z.string().min(8, PASSWORD_TOO_SHORT),
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
  // F-AUTH-05's edit form needs the current values to pre-fill its
  // checkboxes -- without these, it would have no way to know what it's
  // about to overwrite the first time it submits.
  notifyEmail: z.boolean(),
  notifySms: z.boolean(),
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
  newPassword: z.string().min(8, PASSWORD_TOO_SHORT),
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

// F-AUTH-05. Every field optional -- a PATCH updates only what's provided,
// the phone and email have their own dedicated endpoints below because
// changing either needs the current password (F-AUTH-05, "un téléphone =
// un compte" also makes the phone the login identifier).
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Le nom complet doit contenir au moins 2 caractères.')
    .optional(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateProfileResponseSchema = z.object({
  user: authUserSchema,
});
export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>;

// currentPassword required: a hijacked open session must not be able to
// lock the real owner out of their own account by changing the password
// they'd need to recover it.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, PASSWORD_TOO_SHORT),
  newPassword: z.string().min(8, PASSWORD_TOO_SHORT),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const changePasswordResponseSchema = z.object({
  user: authUserSchema,
});
export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;

// Same currentPassword requirement as changePasswordSchema, same reasoning
// -- the phone is the login identifier, changing it is just as sensitive.
export const changePhoneSchema = z.object({
  currentPassword: z.string().min(8, PASSWORD_TOO_SHORT),
  newPhone: ciPhoneSchema,
});
export type ChangePhoneInput = z.infer<typeof changePhoneSchema>;

// Changing the phone drops phoneVerifiedAt back to null and re-sends an
// OTP -- same shape as registerResponseSchema's demo-only raw code for the
// same reason (present only when DEMO_MODE=true).
export const changePhoneResponseSchema = z.object({
  user: authUserSchema,
  demoOtpCode: z.string().optional(),
});
export type ChangePhoneResponse = z.infer<typeof changePhoneResponseSchema>;

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(8, PASSWORD_TOO_SHORT),
  newEmail: z.email(EMAIL_INVALID),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const changeEmailResponseSchema = z.object({
  user: authUserSchema,
});
export type ChangeEmailResponse = z.infer<typeof changeEmailResponseSchema>;
