import { z } from 'zod';
import { COMMUNES } from '@lavenet/shared-domain';

const LABEL_TOO_SHORT = 'Le libellé doit contenir au moins 2 caractères.';
const COMMUNE_INVALID = 'Commune invalide.';
const QUARTIER_TOO_SHORT = 'Le quartier doit contenir au moins 2 caractères.';
// "details" is the repère/indication (F-AUTH-06 bug-avoidance note: most
// addresses in Abidjan have no street number -- this is the field that
// actually gets a courier to the door), required, not an afterthought.
const DETAILS_TOO_SHORT = "Merci d'indiquer un repère pour vous trouver (au moins 3 caractères).";

const communeSchema = z.enum(COMMUNES, COMMUNE_INVALID);
const geoCoordinateSchema = z.number().optional();

export const addressSchema = z.object({
  id: z.string(),
  label: z.string(),
  commune: communeSchema,
  quartier: z.string(),
  details: z.string(),
  geoLat: z.number().nullable(),
  geoLng: z.number().nullable(),
  isDefault: z.boolean(),
});
export type Address = z.infer<typeof addressSchema>;

export const listAddressesResponseSchema = z.object({
  addresses: z.array(addressSchema),
});
export type ListAddressesResponse = z.infer<typeof listAddressesResponseSchema>;

// isDefault is optional here: creating the very first address should be
// promotable to default in the same call, without a required field the
// caller has to think about every other time.
export const createAddressSchema = z.object({
  label: z.string().trim().min(2, LABEL_TOO_SHORT),
  commune: communeSchema,
  quartier: z.string().trim().min(2, QUARTIER_TOO_SHORT),
  details: z.string().trim().min(3, DETAILS_TOO_SHORT),
  geoLat: geoCoordinateSchema,
  geoLng: geoCoordinateSchema,
  isDefault: z.boolean().optional(),
});
export type CreateAddressInput = z.infer<typeof createAddressSchema>;

export const createAddressResponseSchema = z.object({ address: addressSchema });
export type CreateAddressResponse = z.infer<typeof createAddressResponseSchema>;

// PATCH semantics: every field optional, only what's provided changes --
// same convention as updateProfileSchema (auth.schemas.ts).
export const updateAddressSchema = z.object({
  label: z.string().trim().min(2, LABEL_TOO_SHORT).optional(),
  commune: communeSchema.optional(),
  quartier: z.string().trim().min(2, QUARTIER_TOO_SHORT).optional(),
  details: z.string().trim().min(3, DETAILS_TOO_SHORT).optional(),
  geoLat: geoCoordinateSchema,
  geoLng: geoCoordinateSchema,
  isDefault: z.boolean().optional(),
});
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

export const updateAddressResponseSchema = z.object({ address: addressSchema });
export type UpdateAddressResponse = z.infer<typeof updateAddressResponseSchema>;

// Delete has no response schema: 204 No Content, same convention as
// POST /auth/logout (auth.controller.ts).
