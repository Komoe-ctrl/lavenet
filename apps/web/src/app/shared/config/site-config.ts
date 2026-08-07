import { z } from 'zod';
import {
  COMMUNES,
  DELIVERY_FEE_XOF,
  FREE_DELIVERY_THRESHOLD_XOF,
  MIN_ORDER_XOF,
  formatXof,
} from '@lavenet/shared-domain';

// Single source of truth for every piece of business/contact information
// shown on the public pages (brand, contact channels, delivery coverage,
// hours...). Never hardcode any of this in a component -- import
// `siteConfig` instead. See README.md "Mise en service" for how to fill in
// the real values once they're known.
export const siteConfigSchema = z.object({
  brandName: z.string().min(1),
  tagline: z.string().min(1),
  demoNotice: z.string().min(1),
  contact: z.object({
    // Each contact channel is nullable on purpose: until a real value is
    // filled in below, the UI must hide the corresponding link entirely --
    // no dead link, no placeholder, no invented number or address.
    email: z.union([z.email(), z.null()]),
    emailNote: z.string().nullable(),
    phone: z.union([z.e164(), z.null()]),
    whatsapp: z.union([z.e164(), z.null()]),
    address: z.string().nullable(),
  }),
  coverage: z.object({
    communes: z.array(z.string().min(1)).min(1),
    hoursNote: z.string().min(1),
  }),
  delivery: z.object({
    feeNote: z.string().min(1),
    minimumOrderNote: z.string().min(1),
  }),
  social: z.array(
    z.object({
      label: z.string().min(1),
      url: z.url(),
    }),
  ),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

const rawSiteConfig: SiteConfig = {
  brandName: 'LaveNet',
  tagline: "Service de blanchisserie en ligne — Abidjan, Côte d'Ivoire.",
  demoNotice: 'Ce site est un projet de démonstration.',
  contact: {
    // Left empty on purpose: no real contact channel exists yet. Never
    // invent a number, an address or an email -- fill these in here, for
    // real, once known; each corresponding UI element activates on its own.
    email: null,
    emailNote: null,
    phone: null,
    whatsapp: null,
    address: null,
  },
  coverage: {
    // COMMUNES (libs/shared/domain) is the single source of truth -- also
    // used by the address book's commune field (F-AUTH-06), validated
    // server-side, not just picked from a dropdown here.
    communes: [...COMMUNES],
    hoursNote: "Les horaires précis seront communiqués avant l'ouverture de la commande en ligne.",
  },
  // DELIVERY_FEE_XOF / FREE_DELIVERY_THRESHOLD_XOF / MIN_ORDER_XOF
  // (libs/shared/domain/business-config.ts) are the single source of truth
  // -- the API uses the same constants for the real checkout calculation
  // (docs/ADR/0006). Never redeclared here.
  delivery: {
    feeNote: `Livraison à domicile : ${formatXof(DELIVERY_FEE_XOF)}, gratuite dès ${formatXof(FREE_DELIVERY_THRESHOLD_XOF)} d'achat.`,
    minimumOrderNote: `Commande minimum pour la livraison à domicile : ${formatXof(MIN_ORDER_XOF)}. En dessous, le dépôt en agence reste disponible.`,
  },
  social: [],
};

// Parsed eagerly: both public pages are prerendered, so this module runs at
// build time. A missing or malformed field throws here and fails the build,
// instead of silently shipping a broken value to a visitor.
export const siteConfig = siteConfigSchema.parse(rawSiteConfig);
