import { createZodDto } from 'nestjs-zod';
import {
  authUserSchema,
  loginResponseSchema,
  loginSchema,
  refreshResponseSchema,
} from '@lavenet/shared-schemas';

export class LoginDto extends createZodDto(loginSchema) {}
export class AuthUserDto extends createZodDto(authUserSchema) {}
export class LoginResponseDto extends createZodDto(loginResponseSchema) {}
export class RefreshResponseDto extends createZodDto(refreshResponseSchema) {}
