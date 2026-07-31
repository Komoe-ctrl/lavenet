// Minimal demo dataset: one admin, one client. Referenced by the README's
// "demo accounts" section — keep the credentials below in sync with it.
//
// Run via `pnpm db:seed` (dev, reads .env) or `pnpm db:seed:prod` (reads
// .env.production.local — see README "Déploiement"). Never pass production
// credentials through .env: the risk of accidentally leaving them there and
// developing against prod is exactly what the separate file avoids.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';

// `prisma migrate dev` loads .env via prisma.config.ts before spawning this
// script, but running it directly (pnpm db:seed / db:seed:prod) doesn't —
// load the requested env file here so both invocation paths work. Defaults
// to .env; db:seed:prod passes .env.production.local as argv[2].
const envFile = process.argv[2] ?? '.env';
try {
  process.loadEnvFile(envFile);
} catch {
  if (process.argv[2]) {
    // A specific file was requested (e.g. the prod path) and doesn't
    // exist — that's a setup mistake worth failing loudly on, not a
    // silent fallback to whatever's already in process.env.
    throw new Error(`Fichier d'environnement introuvable : ${envFile}`);
  }
  // no .env file (CI) — env vars are expected to be set already
}

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_USERS = [
  { phone: '+2250700000001', email: 'admin@lavenet.ci', role: 'ADMIN' as const },
  { phone: '+2250700000002', email: 'client@lavenet.ci', role: 'CLIENT' as const },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is not set — check ${envFile}.`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

  // Refuses to run against a database that already has data: this seed is
  // meant for a fresh database only, never to silently upsert on top of a
  // live one (production, most of all) and risk masking a wrong-target
  // mistake.
  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    await prisma.$disconnect();
    throw new Error(
      `Refus de seed : la base cible contient déjà ${existingUserCount} utilisateur(s). ` +
        'Ce script ne s’exécute que sur une base vide.',
    );
  }

  const passwordHash = await hash(DEMO_PASSWORD);

  for (const user of DEMO_USERS) {
    await prisma.user.create({
      data: { ...user, passwordHash, phoneVerifiedAt: new Date() },
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
