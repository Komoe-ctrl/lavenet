import { z } from 'zod';

const INSTRUCTIONS_MAX = 250;
const QUANTITY_MAX = 99;

const quantitySchema = z
  .number()
  .int()
  .positive('La quantité doit être supérieure à 0.')
  .max(QUANTITY_MAX, `Quantité maximale : ${QUANTITY_MAX}.`);

const instructionsSchema = z
  .string()
  .trim()
  .max(INSTRUCTIONS_MAX, `Les instructions sont limitées à ${INSTRUCTIONS_MAX} caractères.`);

export const addCartItemSchema = z.object({
  serviceId: z.string().min(1, 'Service requis.'),
  articleTypeId: z.string().min(1).optional(),
  quantity: quantitySchema,
  instructions: instructionsSchema.optional(),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

// PATCH semantics, same convention as updateProfileSchema/updateAddressSchema.
export const updateCartItemSchema = z.object({
  quantity: quantitySchema.optional(),
  instructions: instructionsSchema.optional(),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

// unitPriceXof/lineTotalXof are nullable: the cart always shows a *live*
// price (resolved fresh from the currently active PriceRule on every read,
// never the DB's unitPriceXof column, which stays null until checkout) --
// null here means no PriceRule is active for this line right now, not a
// zero price. hasUnavailablePricing on the cart lets the UI warn before
// checkout instead of showing a silently wrong subtotal.
export const cartItemSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceSlug: z.string(),
  serviceName: z.string(),
  unit: z.enum(['PIECE', 'KG']),
  articleTypeId: z.string().nullable(),
  articleTypeName: z.string().nullable(),
  quantity: z.number().int().positive(),
  instructions: z.string().nullable(),
  unitPriceXof: z.number().int().nonnegative().nullable(),
  lineTotalXof: z.number().int().nonnegative().nullable(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

// id is null when the user has no DRAFT order yet -- an empty cart never
// creates a row just to be looked at. pickupType/agencyId/agencyDropoffDate
// (F-CMD-03) are all null until the client picks a mode via PATCH
// /cart/pickup -- there is no default. agencyId is the raw id, not a
// nested agency object: the web already has the full agency list (fetched
// once from GET /agencies to render the picker) and resolves display info
// from there, so the cart response doesn't duplicate it.
export const cartSchema = z.object({
  id: z.string().nullable(),
  items: z.array(cartItemSchema),
  subtotalXof: z.number().int().nonnegative().nullable(),
  hasUnavailablePricing: z.boolean(),
  // z.union of literals, not z.enum -- a nullable z.enum's generated
  // OpenAPI schema puts a literal `null` inside the `enum` array (zod v4 +
  // nestjs-zod's OpenAPI-3.0 downgrade), which the Angular client
  // generator (ng-openapi-gen) mis-renders as the *string* `'null'`
  // instead of the `null` keyword. This shape avoids that: run
  // `pnpm api:client` and check pickupType's generated type stays
  // `'HOME' | 'AGENCY' | null` (real null) if this ever needs to change.
  pickupType: z.union([z.literal('HOME'), z.literal('AGENCY')]).nullable(),
  agencyId: z.string().nullable(),
  agencyDropoffDate: z.iso.date().nullable(),
});
export type Cart = z.infer<typeof cartSchema>;

export const cartResponseSchema = z.object({ cart: cartSchema });
export type CartResponse = z.infer<typeof cartResponseSchema>;
