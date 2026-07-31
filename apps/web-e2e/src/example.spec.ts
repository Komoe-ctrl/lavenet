import { test, expect } from '@playwright/test';

// Minimal smoke coverage, replacing the Nx scaffold placeholder (asserted
// an <h1> containing "Welcome" that hasn't existed since the real homepage
// was built). Not one of the 3 parcours CLAUDE.md §7 requires
// (inscription+OTP, commande complète jusqu'au paiement, changement de
// statut admin) — those need features (catalogue, checkout, back-office)
// that don't exist yet.

test('homepage renders and links to login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LaveNet' })).toBeVisible();

  await page.getByRole('link', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});

// Depends on the demo seed (pnpm db:seed) existing in whatever database the
// target server uses — true for local dev, not wired into CI yet (no
// e2e step there today, so this doesn't run against the unseeded CI DB).
test('login with valid demo credentials reaches the protected account page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@lavenet.ci');
  await page.getByLabel('Mot de passe').fill('Demo1234!');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/compte$/);
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await expect(page.getByText('admin@lavenet.ci')).toBeVisible();
});
