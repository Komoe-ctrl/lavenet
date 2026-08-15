import { z } from 'zod';

// F-PAY-01/02/04.
export const paymentProviderSchema = z.enum(['CASH', 'MOBILE_MONEY']);
export type PaymentProviderValue = z.infer<typeof paymentProviderSchema>;

export const paymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export type PaymentStatusValue = z.infer<typeof paymentStatusSchema>;

// idempotencyKey/providerRef/rawPayload never leave the API -- internal to
// the webhook's replay guard (F-PAY-03) and the provider integration, not
// something a client needs to see.
export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  provider: paymentProviderSchema,
  status: paymentStatusSchema,
  amountXof: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export type Payment = z.infer<typeof paymentSchema>;

// POST /orders/:id/payment. No amount here -- CLAUDE.md §4 rule 6:
// amountXof is always re-read from Order.totalXof server-side, a client
// supplying it would be exactly the thing this rule exists to prevent.
export const createPaymentInputSchema = z.object({ provider: paymentProviderSchema });
export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

export const createPaymentResponseSchema = z.object({ payment: paymentSchema });
export type CreatePaymentResponse = z.infer<typeof createPaymentResponseSchema>;
