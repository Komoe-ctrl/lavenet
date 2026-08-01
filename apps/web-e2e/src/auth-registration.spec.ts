import { test, expect } from '@playwright/test';

// One of the 3 parcours required by CLAUDE.md §7. Needs a local API server
// running against a reachable database (same assumption as example.spec.ts)
// but not the demo seed -- registration creates its own user, unique per
// run via the timestamp in the phone number.
test('registers, verifies the phone via the demo OTP banner, and reaches the account page', async ({
  page,
}) => {
  const uniqueDigits = Date.now().toString().slice(-8);
  const phone = `+22506${uniqueDigits}`;

  await page.goto('/register');
  await page.getByLabel('Nom complet').fill('Aya Kouassi');
  await page.getByLabel('Téléphone').fill(phone);
  await page.getByLabel('Mot de passe').fill('Demo1234!');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page).toHaveURL(/\/otp-verify$/);
  await expect(page.getByText('Mode démonstration')).toBeVisible();

  await page.getByRole('button', { name: 'Remplir' }).click();
  await page.getByRole('button', { name: 'Vérifier' }).click();

  await expect(page).toHaveURL(/\/compte$/);
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByText('non vérifié')).toBeHidden();
});
