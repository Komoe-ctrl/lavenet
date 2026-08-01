import { resolveCatalogWarmupUrl } from './warm-up-url';

// Pings the production API before `ng build` so the prerender pass for /
// and /tarifs (apps/web/src/app/app.routes.server.ts) — both of which fetch
// GET /catalog at build time, see apps/web/src/app/features/catalog — hits
// an already-warm server.
//
// This isn't just an optimization: @angular/build's SSR render-worker
// enforces a fixed, non-configurable 30s timeout per prerendered route
// (node_modules/@angular/build/src/utils/server-rendering/render-worker.js).
// A cold Render dyno plus a cold Neon connection (Prisma connects lazily,
// see apps/api/src/prisma/prisma.service.ts) measured together can exceed
// that on the very first request after a period of inactivity — reproduced
// locally while building this feature, not a hypothetical.
//
// On failure this exits non-zero and stops the build. That's intentional:
// Vercel keeps serving the last successful deployment when a build fails,
// so a broken build is safe, while a silently empty tariff page shipped to
// production is not (see docs/DETTE.md).
const CATALOG_URL = process.env.API_WARMUP_URL ?? resolveCatalogWarmupUrl();

// 3 x 60s = 3 minutes total budget. Real-world justification, not a guess:
// verifying this script against the live API hit a cold start that timed
// out a full 45s attempt before succeeding on the second try in 8s (see
// docs/ADR/0003-cold-start-strategy.md) — a single retry with a tight
// budget was already observed to be marginal.
const ATTEMPT_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

// A 404 means the route doesn't exist at this URL on whatever is currently
// deployed -- retrying changes nothing, it will 404 again immediately.
// Distinct from a timeout or 5xx, both of which a cold or momentarily
// overloaded server can recover from on the next attempt.
class FatalWarmupError extends Error {}

async function attempt(attemptNumber: number): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(CATALOG_URL, { signal: controller.signal });
    const elapsedMs = Date.now() - startedAt;

    if (res.status === 404) {
      throw new FatalWarmupError(
        `[warm-up] route introuvable (404) après ${elapsedMs}ms sur ${CATALOG_URL} -- ce n'est pas un ` +
          "problème de lenteur, l'URL ou le déploiement Render correspondant est en cause. Vérifier " +
          "l'hôte, le préfixe /api, et que le déploiement Render a bien terminé avant ce build Vercel.",
      );
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} après ${elapsedMs}ms`);
    }

    console.log(
      `[warm-up] API prête après ${elapsedMs}ms (tentative ${attemptNumber}/${MAX_ATTEMPTS}) — ${CATALOG_URL}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber += 1) {
    try {
      await attempt(attemptNumber);
      return;
    } catch (err) {
      if (err instanceof FatalWarmupError) {
        console.error(err.message);
        process.exit(1);
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[warm-up] tentative ${attemptNumber}/${MAX_ATTEMPTS} échouée : ${message}`);
    }
  }

  console.error(
    `[warm-up] API injoignable après ${MAX_ATTEMPTS} tentatives de ${ATTEMPT_TIMEOUT_MS}ms chacune ` +
      `(${CATALOG_URL}). Build interrompu plutôt que de prerendre contre une API froide ou injoignable ` +
      '(voir docs/DETTE.md).',
  );
  process.exit(1);
}

main();
