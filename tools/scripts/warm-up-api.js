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
const CATALOG_URL = process.env.API_WARMUP_URL ?? 'https://lavenet-api.onrender.com/api/catalog';
const ATTEMPT_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 2;

async function attempt(attemptNumber) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(CATALOG_URL, { signal: controller.signal });
    const elapsedMs = Date.now() - startedAt;
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    console.log(
      `[warm-up] API ready after ${elapsedMs}ms (attempt ${attemptNumber}/${MAX_ATTEMPTS}).`,
    );
    return true;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.error(
      `[warm-up] attempt ${attemptNumber}/${MAX_ATTEMPTS} failed after ${elapsedMs}ms: ${err.message}`,
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber += 1) {
    if (await attempt(attemptNumber)) {
      return;
    }
  }
  console.error(
    `[warm-up] API did not respond after ${MAX_ATTEMPTS} attempts of ${ATTEMPT_TIMEOUT_MS}ms each. ` +
      'Aborting the build rather than prerendering against a cold or unreachable API, which would ' +
      'risk shipping a silently empty tariff page (see docs/DETTE.md).',
  );
  process.exit(1);
}

main();
