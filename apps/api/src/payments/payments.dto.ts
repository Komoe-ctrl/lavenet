import { createZodDto } from 'nestjs-zod';
import { createPaymentInputSchema, createPaymentResponseSchema } from '@lavenet/shared-schemas';

export class CreatePaymentDto extends createZodDto(createPaymentInputSchema) {}
export class CreatePaymentResponseDto extends createZodDto(createPaymentResponseSchema) {}
