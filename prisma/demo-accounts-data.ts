import type { PrismaClient } from '@prisma/client';

// Shared by prisma/seed.ts (fresh-database demo seed) and
// prisma/seed-demo-accounts.ts (idempotent, safe to rerun against
// production -- same convention as catalog-data.ts/agency-data.ts). One
// data source, one seeding function: the two scripts must never describe
// two different admin/client accounts.
export const DEMO_PASSWORD = 'Demo1234!';

export const DEMO_USERS = [
  {
    phone: '+2250700000001',
    email: 'admin@lavenet.ci',
    fullName: 'Admin LaveNet',
    role: 'ADMIN' as const,
  },
  {
    phone: '+2250700000002',
    email: 'client@lavenet.ci',
    fullName: 'Client Démo',
    role: 'CLIENT' as const,
  },
  // F-LIV. First real use of role=COURIER -- previously declared in
  // UserRole but never assigned to any account.
  {
    phone: '+2250700000003',
    email: 'livreur@lavenet.ci',
    fullName: 'Livreur Démo',
    role: 'COURIER' as const,
  },
];

export interface SeedDemoAccountsResult {
  created: number;
  updated: number;
}

// Idempotent: creates each account fresh (with the real password/role) if
// it doesn't exist yet; if it already does, only ever backfills fullName
// when null -- never touches password, role or phone of an account that
// might already be in real (if demo) use. This is what fixes accounts
// created by an earlier version of this seed, before fullName was added.
export async function seedDemoAccounts(
  prisma: PrismaClient,
  passwordHash: string,
): Promise<SeedDemoAccountsResult> {
  let created = 0;
  let updated = 0;

  for (const user of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      if (!existing.fullName) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { fullName: user.fullName },
        });
        updated += 1;
      }
      continue;
    }

    await prisma.user.create({
      data: { ...user, passwordHash, phoneVerifiedAt: new Date() },
    });
    created += 1;
  }

  return { created, updated };
}
