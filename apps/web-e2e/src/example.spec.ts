import { test, expect } from '@playwright/test';

// Minimal smoke coverage, replacing the Nx scaffold placeholder (asserted
// an <h1> containing "Welcome" that hasn't existed since the real homepage
// was built). Not one of the 3 parcours CLAUDE.md §7 requires (inscription+
// OTP, commande complète jusqu'au paiement, changement de statut admin) --
// see auth-registration.spec.ts, order-checkout-payment.spec.ts and
// admin-order-status.spec.ts for those.
//
// Not run in CI (.github/workflows/ci.yml deliberately lists the 3 parcours
// spec files by name rather than the whole directory) -- the first test
// below is unreliable there specifically, for a real, understood reason,
// not flakiness: the home page is designed to be prerendered at build time
// (app.routes.server.ts's RenderMode.Prerender, see home-page.ts's own
// comment and ADR 0003), with its catalog fetch baked into the static HTML
// `ng build` produces. CI's e2e job runs `web:serve` instead (deliberately,
// to keep environment.ts's localhost:3000 API URL rather than `nx build`
// web's default `production` configuration, which points at the real
// deployed Render API -- see that job's own comment), and the dev server
// doesn't prerender anything: this route falls back to a live SSR fetch on
// every request instead, which was observed to occasionally exceed the 15s
// assertion timeout under CI's constrained CPU. None of the 3 required
// parcours ever visit '/', so this doesn't affect them.
test('homepage renders and links to login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LaveNet' })).toBeVisible();

  await page.getByRole('link', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});

// Depends on the demo seed (pnpm db:seed) existing in whatever database the
// target server uses -- true for local dev; not run in CI at all currently
// (see the file-level comment above).
test('login with valid demo credentials reaches the protected account page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@lavenet.ci');
  await page.getByLabel('Mot de passe').fill('Demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/compte$/);
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await expect(page.getByText('admin@lavenet.ci')).toBeVisible();
});
