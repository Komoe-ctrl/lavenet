// Minimal demo dataset: one admin, one client. Referenced by the README's
// "demo accounts" section — keep the credentials below in sync with it.
// Run via `pnpm db:seed` (or automatically after `prisma migrate dev`).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';

// `prisma migrate dev` loads .env via prisma.config.ts before spawning this
// script, but `pnpm db:seed` runs it directly — load .env here too so both
// invocation paths work.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file (CI, production) — env vars are expected to be set already
}

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_USERS = [
  { phone: '+2250700000001', email: 'admin@lavenet.ci', role: 'ADMIN' as const },
  { phone: '+2250700000002', email: 'client@lavenet.ci', role: 'CLIENT' as const },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — run with the same .env as the API.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  const passwordHash = await hash(DEMO_PASSWORD);

  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: {},
      create: { ...user, passwordHash, phoneVerifiedAt: new Date() },
    });
  }

  console.log('Seeded demo accounts (password for both: %s):', DEMO_PASSWORD);
  for (const user of DEMO_USERS) {
    console.log(`  ${user.role.padEnd(6)} — ${user.email}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
