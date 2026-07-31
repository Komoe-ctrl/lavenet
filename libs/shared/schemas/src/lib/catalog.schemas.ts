import { z } from 'zod';

// Output shape only: F-CAT-04 (public tariff page) is read-only, no input
// DTO exists yet for this module — creating/editing PriceRule is the
// back-office scope (F-ADM-04, not built in this lot).
export const catalogPriceSchema = z.object({
  articleTypeId: z.string().nullable(),
  articleTypeName: z.string().nullable(),
  amountXof: z.number().int().nonnegative(),
});
export type CatalogPrice = z.infer<typeof catalogPriceSchema>;

export const catalogServiceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  unit: z.enum(['PIECE', 'KG']),
  processingHours: z.number().int().positive(),
  prices: z.array(catalogPriceSchema),
});
export type CatalogService = z.infer<typeof catalogServiceSchema>;

export const catalogCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  position: z.number().int(),
  services: z.array(catalogServiceSchema),
});
export type CatalogCategory = z.infer<typeof catalogCategorySchema>;

export const catalogResponseSchema = z.object({
  categories: z.array(catalogCategorySchema),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
