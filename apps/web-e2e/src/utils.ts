import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// This app is server-rendered with client hydration. Landing on a fresh
// page and filling its first field immediately is not safe: Playwright's
// .fill() writes the DOM value directly and fires an `input` event, but if
// Angular hasn't attached its own (input) listener yet, that event is lost
// -- the signal behind the field never updates, even though the DOM still
// *shows* the typed text (so a naive fill-then-toHaveValue check passes).
// Hydration then runs its first change-detection pass moments later,
// reconciling `[value]="field()"` against the still-empty signal, which
// silently wipes the DOM back to blank. Only the very first interaction
// after a fresh navigation is at risk -- every later field, and every
// later in-app (click-based) navigation, happens well after hydration has
// already won that race.
//
// waitForLoadState('networkidle') is the closest external proxy for
// "hydration is done" available without instrumenting the app itself: it
// waits out the client bundle's initial load and its first resource()
// calls, which is reliably later than hydration's own CD pass in
// practice. The fixed pause after it is a deliberate, small extra margin,
// not a substitute for it.
//
// Both playwright/no-networkidle and playwright/no-wait-for-timeout exist
// to stop naive waits from papering over flaky assertions elsewhere --
// that's not what's happening here. There is no DOM-observable signal for
// "Angular hydration finished" to assert on instead (that's the whole
// problem this function works around); a fixed, generously-sized wait is
// the deliberate fix for a diagnosed framework race, not a substitute for
// one, and fillReliably() still backs it up with a real retrying
// assertion for the field this matters most for. Both rules are turned
// off for this file in eslint.config.mjs rather than disabled inline
// here: an inline disable comment gets treated as unused (and silently
// deleted by --fix) under the lint-staged pre-commit hook, which resolves
// this nested project's ESLint config differently than `nx run
// web-e2e:lint` (used in CI) does on this OS.
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

// Extra safety net on top of waitForHydration for the one field filled
// immediately after it: verifies the fill actually stuck and retries if a
// late change-detection pass still wiped it.
export async function fillReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}
