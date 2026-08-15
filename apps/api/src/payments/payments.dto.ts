import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { createPaymentInputSchema, createPaymentResponseSchema } from '@lavenet/shared-schemas';

export class CreatePaymentDto extends createZodDto(createPaymentInputSchema) {}
export class CreatePaymentResponseDto extends createZodDto(createPaymentResponseSchema) {}

// F-PAY-03. Provider-internal shape -- only a payment gateway's callback
// (or, in demo mode, the sandbox simulate trigger building the identical
// shape) ever sends this. Never consumed by the Angular client, so it
// stays local instead of in @lavenet/shared-schemas.
export const webhookPayloadSchema = z.object({
  idempotencyKey: z.string(),
  status: z.enum(['PAID', 'FAILED']),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

const simulatePaymentInputSchema = z.object({ outcome: z.enum(['PAID', 'FAILED']) });
export class SimulatePaymentDto extends createZodDto(simulatePaymentInputSchema) {}
