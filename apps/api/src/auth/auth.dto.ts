import { createZodDto } from 'nestjs-zod';
import {
  authUserSchema,
  loginResponseSchema,
  loginSchema,
  otpResponseSchema,
  passwordResetConfirmResponseSchema,
  passwordResetConfirmSchema,
  passwordResetRequestResponseSchema,
  passwordResetRequestSchema,
  refreshResponseSchema,
  registerResponseSchema,
  registerSchema,
  verifyOtpResponseSchema,
  verifyOtpSchema,
} from '@lavenet/shared-schemas';

export class LoginDto extends createZodDto(loginSchema) {}
export class RegisterDto extends createZodDto(registerSchema) {}
export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}
export class AuthUserDto extends createZodDto(authUserSchema) {}
export class LoginResponseDto extends createZodDto(loginResponseSchema) {}
export class RegisterResponseDto extends createZodDto(registerResponseSchema) {}
export class OtpResponseDto extends createZodDto(otpResponseSchema) {}
export class VerifyOtpResponseDto extends createZodDto(verifyOtpResponseSchema) {}
export class RefreshResponseDto extends createZodDto(refreshResponseSchema) {}
export class PasswordResetRequestDto extends createZodDto(passwordResetRequestSchema) {}
export class PasswordResetRequestResponseDto extends createZodDto(
  passwordResetRequestResponseSchema,
) {}
export class PasswordResetConfirmDto extends createZodDto(passwordResetConfirmSchema) {}
export class PasswordResetConfirmResponseDto extends createZodDto(
  passwordResetConfirmResponseSchema,
) {}
