import { createZodDto } from 'nestjs-zod';
import { adminDashboardResponseSchema } from '@lavenet/shared-schemas';

export class AdminDashboardResponseDto extends createZodDto(adminDashboardResponseSchema) {}
