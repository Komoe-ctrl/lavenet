import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// F-ADM-08. Query-param shape only, validated server-side -- never
// consumed by the Angular client as a typed schema (it just builds the
// query string when triggering the download), same reasoning as
// payments' webhookPayloadSchema: stays local instead of
// @lavenet/shared-schemas.
export const exportDateRangeQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});
export class ExportDateRangeQueryDto extends createZodDto(exportDateRangeQuerySchema) {}
