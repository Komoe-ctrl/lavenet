import { createZodDto } from 'nestjs-zod';
import { catalogResponseSchema } from '@lavenet/shared-schemas';

export class CatalogResponseDto extends createZodDto(catalogResponseSchema) {}
