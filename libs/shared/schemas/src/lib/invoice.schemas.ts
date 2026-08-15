import { z } from 'zod';

// F-PAY-05. Just enough for the client to know an invoice exists and link
// to GET /invoices/:id/pdf -- the issuer/VAT snapshot and line items only
// ever render inside the PDF itself, never duplicated into JSON here.
export const invoiceSummarySchema = z.object({
  id: z.string(),
  number: z.string(),
  issuedAt: z.iso.datetime(),
});
export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>;
