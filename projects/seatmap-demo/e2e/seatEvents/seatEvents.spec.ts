import { expect, test } from '@playwright/test';
import * as path from 'path';
import { applyConfigAndReady, setAvailability } from '../helpers/demo';

const OUT_DIR = path.join(__dirname, 'screenshots');

/**
 * End-to-end smoke for the three React-parity events:
 *
 *   - `seatMouseClick`      — fires on a real click when
 *                              `externalPassengerManagement && tooltipOnHover`
 *                              on a non-touch device. Crucially fires
 *                              regardless of `builtInTooltip` — that was the
 *                              bug the spec guards against.
 *   - `seatMouseLeave`      — React-parity: fires when the cursor leaves a seat
 *                              **only** while `tooltipOnHover === true` (the
 *                              hover-mode DOM listener path).
 *   - `availabilityApplied` — fires after availability is applied; payload
 *                              splits provided labels into existing /
 *                              non-existing buckets.
 *
 * Hovers, then clicks, then moves the cursor away. Asserts the demo's event
 * log captured all three events, then snapshots the panel.
 */

test.use({ viewport: { width: 1800, height: 1100 } });

test('seat events — react-parity contract', async ({ page }) => {
  await page.goto('/');

  await applyConfigAndReady(page, {
    width: 420,
    externalPassengerManagement: true,
    tooltipOnHover: true,
    // builtInTooltip left at its default (true) — the regression scenario.
  });

  // Includes a deliberately bogus label so availabilityApplied has something
  // to put into `nonExistingSeatLabels`.
  await setAvailability(page, [
    { currency: 'USD', label: '20A', price: 33 },
    { currency: 'USD', label: '20E', price: 33 },
    { currency: 'USD', label: '21F', price: 13 },
    { currency: 'USD', label: '70E', price: 133399 },
    { currency: 'USD', label: 'ZZ9', price: 0 },
  ]);

  const seat = page.locator('.jets-seat.jets-seat--available').first();
  await seat.waitFor({ state: 'visible', timeout: 15_000 });
  await seat.scrollIntoViewIfNeeded();

  // Direct dispatch — avoids Playwright's actionability checks and any
  // accidental overlap with the hover-mode tooltip. Each call awaits a
  // microtask + 100ms so Angular's change detection runs between events.
  await seat.dispatchEvent('mouseenter');
  await page.waitForTimeout(100);
  await seat.dispatchEvent('click');
  await page.waitForTimeout(100);
  await seat.dispatchEvent('mouseleave');
  await page.waitForTimeout(150);

  // Event-log assertions — these are the actual contract checks.
  const log = page.locator('.demo-log-list');
  await expect(log.locator('.log-mouseClick').first()).toContainText('Mouse click seat');
  await expect(log.locator('.log-mouseLeave').first()).toContainText('Mouse leave seat');
  // Last availability run should reflect ZZ9 as missing.
  await expect(log.locator('.log-availability').first()).toContainText('missing: 2');

  // Snapshots — the log column is the readable one; the full page gives
  // context (seat map + controls + log together).
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForTimeout(100);
  await page.screenshot({
    path: path.join(OUT_DIR, 'seatEvents-full.png'),
    fullPage: true,
  });
  await page.locator('.demo-right-column').screenshot({
    path: path.join(OUT_DIR, 'seatEvents-log.png'),
  });
});
