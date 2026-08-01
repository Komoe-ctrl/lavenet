import { createZodDto } from 'nestjs-zod';
import {
  authUserSchema,
  loginResponseSchema,
  loginSchema,
  otpResponseSchema,
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
