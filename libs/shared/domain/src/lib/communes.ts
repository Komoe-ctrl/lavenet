// Single source of truth for the communes LaveNet covers in Abidjan.
// Both the public coverage list (apps/web/.../site-config.ts) and the
// address book (F-AUTH-06 — commune field, validated on the API too, not
// just picked from a UI dropdown) read from this one list.
export const COMMUNES = [
  'Cocody',
  'Plateau',
  'Marcory',
  'Treichville',
  'Yopougon',
  'Adjamé',
  'Koumassi',
  'Port-Bouët',
] as const;

export type Commune = (typeof COMMUNES)[number];
