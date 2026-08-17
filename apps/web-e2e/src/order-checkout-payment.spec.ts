import { test, expect } from '@playwright/test';
import { fillReliably, waitForHydration } from './utils';

// The 2nd of CLAUDE.md §7's mandated Playwright parcours ("commande
// complète jusqu'au paiement"). Registers its own user (unique phone per
// run, same trick as auth-registration.spec.ts) rather than reusing the
// demo client account: this test writes an address, a cart, an order and a
// payment, and a shared demo account mutated by every CI run would make
// later runs (and admin-order-status.spec.ts's own use of the demo seed)
// increasingly unpredictable. No mock anywhere in the chain -- checkout,
// slot booking and the Mobile Money sandbox all really run; "simuler la
// confirmation" is the app's own designed stand-in for a real provider
// callback (F-PAY-03), not a test-side shortcut.
//
// Every hop after the first is a click, not page.goto(): a goto() is a
// full reload, and this SPA's session lives in an in-memory signal seeded
// once at bootstrap (SessionStore's lazy restore) -- a mid-test reload
// forces a second restore round trip that isn't guaranteed to win the race
// against the assertions right after it. Clicking through, like a real
// visitor, never triggers that reload at all.
test('registers, builds a cart, checks out, and confirms a Mobile Money payment', async ({
  page,
}) => {
  // The longest of the 3 parcours by far (registration, an address, a full
  // cart funnel, checkout, a payment round trip) -- each dev-server route
  // is also JIT-compiled on its first request in this environment, unlike
  // a production build. The default 30s test-wide budget is tuned for a
  // single page, not this chain.
  test.setTimeout(90_000);

  const uniqueDigits = Date.now().toString().slice(-8);
  const phone = `+22507${uniqueDigits}`;

  // 1. Register and verify the phone (mechanics only -- the UI itself is
  // covered by auth-registration.spec.ts).
  await page.goto('/register');
  await waitForHydration(page);
  await fillReliably(page.getByLabel('Nom complet'), 'Client E2E');
  await page.getByLabel('Téléphone').fill(phone);
  await page.getByLabel('Mot de passe').fill('Demo1234!');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/otp-verify$/);
  await page.getByRole('button', { name: 'Remplir' }).click();
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page).toHaveURL(/\/compte$/);

  // 2. A fresh account has no saved address -- checkout needs one.
  await page.getByRole('link', { name: "Carnet d'adresses" }).click();
  await expect(page).toHaveURL(/\/compte\/adresses$/);
  await page.getByLabel('Libellé').fill('Domicile');
  await page.getByLabel('Commune').selectOption('Cocody');
  await page.getByLabel('Quartier').fill('Angré');
  await page.getByLabel('Repère (indication pour vous trouver)').fill('Portail bleu, 2e étage');
  await page.getByRole('button', { name: 'Ajouter cette adresse' }).click();
  await expect(page.getByText('Angré')).toBeVisible();

  // 3. Add the first available priced service to the cart (the empty cart
  // links to /tarifs, so this stays a click-through from here on too).
  await page.getByRole('link', { name: 'Mon panier' }).click();
  await expect(page).toHaveURL(/\/panier$/);
  await page.getByRole('link', { name: 'Voir les tarifs' }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
  // Quantity 3, not the default 1: HOME delivery has a minimum order
  // amount (F-CMD §5.3, MIN_ORDER_XOF), and a single unit of the cheapest
  // service falls under it -- checkout would otherwise silently stay
  // disabled behind "Montant minimum pour un enlèvement à domicile".
  const firstRow = page.locator('.add-to-cart').first();
  await firstRow.getByRole('spinbutton').fill('3');
  await firstRow.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(firstRow.getByRole('button', { name: 'Ajouté ✓' })).toBeVisible();

  // 4. Cart funnel: pickup mode, slots, address.
  await page.getByRole('link', { name: 'Mon panier' }).click();
  await expect(page).toHaveURL(/\/panier$/);
  await page.getByRole('radio', { name: /Enlèvement à domicile/ }).check();
  await page.getByRole('button', { name: 'Valider le mode de retrait' }).click();
  await expect(page.getByLabel('Créneau de retrait')).toBeVisible();

  // Earliest pickup slot, latest delivery slot -- guarantees the delivery
  // slot clears the service's processing-time floor regardless of which
  // service got added above, without hardcoding a specific gap.
  await page.getByLabel('Créneau de retrait').selectOption({ index: 1 });
  const deliverySlot = page.getByLabel('Créneau de livraison');
  const deliverySlotCount = await deliverySlot.locator('option').count();
  await deliverySlot.selectOption({ index: deliverySlotCount - 1 });
  await page.getByRole('button', { name: 'Valider les créneaux' }).click();

  await expect(page.getByLabel('Adresse')).toBeVisible();
  await page.getByLabel('Adresse').selectOption({ index: 1 });
  await page.getByRole('button', { name: "Valider l'adresse" }).click();

  // 5. Checkout -- server recomputes and freezes the total, never trusts
  // anything the client sent.
  // Checkout is a real multi-write transaction (slot booking, the
  // reference sequence, price freezing, CLAUDE.md's "transactions Prisma
  // pour toute opération multi-écritures") against a remote Postgres --
  // the config's 15s default expect timeout (not the usual 5s) covers this
  // and every other save-then-reload step in the funnel above.
  await page.getByRole('button', { name: 'Valider la commande' }).click();
  await expect(page.getByRole('heading', { name: 'Commande validée' })).toBeVisible();
  await expect(page.getByText('Référence')).toBeVisible();

  // 6. Payment: Mobile Money, then the sandbox's own "simulate" callback
  // (F-PAY-02/03) -- a real payment record, a real provider confirmation
  // round trip, all the way to PAID.
  await page.getByRole('radio', { name: /Mobile Money/ }).check();
  await page.getByRole('button', { name: 'Choisir ce mode de paiement' }).click();
  await expect(page.getByRole('button', { name: /Simuler la confirmation/ })).toBeVisible();
  await page.getByRole('button', { name: /Simuler la confirmation/ }).click();

  await expect(page.getByText(/Paiement confirmé/)).toBeVisible();
});
