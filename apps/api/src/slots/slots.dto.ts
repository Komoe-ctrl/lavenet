import { createZodDto } from 'nestjs-zod';
import { slotsResponseSchema } from '@lavenet/shared-schemas';

export class SlotsResponseDto extends createZodDto(slotsResponseSchema) {}
