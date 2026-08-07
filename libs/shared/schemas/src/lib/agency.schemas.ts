import { z } from 'zod';

// F-CMD-03: public reference data (name/address/openingHours), fetched
// once by the checkout tunnel to render the agency picker and, once an
// agency is chosen, its opening hours. No auth required to read it -- it's
// no more sensitive than the catalog.
export const agencySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  openingHours: z.string(),
});
export type Agency = z.infer<typeof agencySchema>;

export const agenciesResponseSchema = z.object({ agencies: z.array(agencySchema) });
export type AgenciesResponse = z.infer<typeof agenciesResponseSchema>;
