import { test, expect } from '@playwright/test';
import { fillReliably, waitForHydration } from './utils';

// The 3rd of CLAUDE.md §7's mandated Playwright parcours ("changement de
// statut par un admin"). Needs the demo seed (pnpm db:seed) -- same
// assumption as example.spec.ts's login test -- for admin@lavenet.ci and
// LN-DEMO-024 (seeded PENDING_PICKUP, see prisma/order-data.ts). This test
// consumes that order's only legal PICKED_UP transition, so rerunning it
// needs `pnpm db:seed:demo-orders` first to reset LN-DEMO-024 back to
// PENDING_PICKUP (that script is idempotent by design, see prisma/order-data.ts).
test('an admin advances a demo order from PENDING_PICKUP to PICKED_UP', async ({ page }) => {
  await page.goto('/login');
  // This app hydrates client-side after SSR, and the very first field
  // filled right after a fresh navigation can race that hydration -- see
  // utils.ts. waitForHydration first, fillReliably as a second safety net.
  await waitForHydration(page);
  await fillReliably(page.getByLabel('Email'), 'admin@lavenet.ci');
  await page.getByLabel('Mot de passe').fill('Demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/compte$/);

  await page.getByRole('link', { name: 'Back-office' }).click();
  await expect(page).toHaveURL(/\/admin\/commandes$/);
  await expect(page.getByRole('heading', { name: 'Commandes -- back-office' })).toBeVisible();

  await page.getByRole('link', { name: /LN-DEMO-024/ }).click();
  await expect(page.getByRole('heading', { name: /LN-DEMO-024/ })).toBeVisible();
  // Not getByText("En attente d'enlèvement") alone: the transition history
  // panel (added after this test was first written) now also prints that
  // label in "Brouillon → En attente d'enlèvement", which breaks Playwright
  // strict mode with two matches. .current-status is deliberately the one
  // element carrying the full "Statut actuel : X" string, exactly for this
  // (see admin-order-detail-page.scss's own comment on it).
  await expect(page.locator('.current-status')).toHaveText(
    "Statut actuel : En attente d'enlèvement",
  );

  await page.getByRole('button', { name: 'Récupéré', exact: true }).click();

  await expect(page.getByText('Statut actuel : Récupéré')).toBeVisible();
  await expect(page.locator('.history-list')).toContainText('Récupéré');
});
