import type { PrismaClient } from '@prisma/client';

// Shared by prisma/seed.ts (fresh-database demo seed) and
// prisma/seed-agency.ts (idempotent, safe to rerun against production).
// One agency, one row, for now (CAHIER-DES-CHARGES.md §5.1: single agency
// in V1, but the model supports more later -- see the Agency comment in
// prisma/schema.prisma). Name/address/opening hours are demo placeholder
// content, not a real business address -- same spirit as the invented
// catalog prices in catalog-data.ts. Replace with the real agency's
// details here, in one place, once known.
export const AGENCY = {
  slug: 'lavenet-cocody',
  name: 'LaveNet Cocody',
  address: 'Cocody, Angré, Abidjan',
  openingHours: 'Lundi - Samedi, 8h00 - 18h00 (fermé le dimanche)',
} as const;

export interface SeedAgencyResult {
  created: boolean;
}

// Idempotent: upserts by slug, safe to rerun (display fields updated in
// place, id/relations untouched).
export async function seedAgency(prisma: PrismaClient): Promise<SeedAgencyResult> {
  const existing = await prisma.agency.findUnique({ where: { slug: AGENCY.slug } });

  await prisma.agency.upsert({
    where: { slug: AGENCY.slug },
    create: AGENCY,
    update: { name: AGENCY.name, address: AGENCY.address, openingHours: AGENCY.openingHours },
  });

  return { created: !existing };
}
