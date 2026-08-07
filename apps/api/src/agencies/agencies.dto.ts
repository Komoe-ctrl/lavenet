import { createZodDto } from 'nestjs-zod';
import { agenciesResponseSchema } from '@lavenet/shared-schemas';

export class AgenciesResponseDto extends createZodDto(agenciesResponseSchema) {}
