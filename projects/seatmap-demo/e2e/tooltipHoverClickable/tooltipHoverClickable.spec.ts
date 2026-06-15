/**
 * Regression: in `tooltipOnHover` mode, the tooltip body (and the buttons
 * inside it — Select / Cancel / Close-X) must be clickable. Before the fix
 * `onSeatMouseLeave` synchronously cleared `activeTooltip`, so by the time
 * the cursor reached the tooltip the buttons were already gone from the DOM.
 *
 * This spec drives the bug from the user's POV:
 *   1. open demo with builtInTooltip + tooltipOnHover
 *   2. hover a seat → tooltip appears
 *   3. move the cursor onto the Cancel button (this is the "bridge moment"
 *      where the old code would have torn the tooltip down)
 *   4. assert the tooltip is still in the DOM and the button is visible
 *   5. click the button → tooltip closes
 *
 * Video is recorded for the whole spec so the fix can be reviewed visually.
 */
import { expect, test } from '@playwright/test';
import { applyConfigAndReady } from '../helpers/demo';

// Record video for both the pass case (proves the fix works) and any future
// regressions. Lives in `test-results/` next to traces by default.
test.use({ video: 'on' });

test.describe('tooltip hover clickable', () => {
  test('Cancel button inside hover-tooltip stays reachable and clickable', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {
      builtInTooltip: true,
      tooltipOnHover: true,
    });

    // Pick the first interactive seat — its exact label doesn't matter, we
    // just need *something* with a tooltip that exposes the action block.
    const interactiveSeatSelector =
      '.jets-seat.jets-seat--available, ' +
      '.jets-seat.jets-seat--selected, ' +
      '.jets-seat.jets-seat--preferred, ' +
      '.jets-seat.jets-seat--extra';
    const seat = page.locator(interactiveSeatSelector).first();
    await seat.waitFor({ state: 'visible', timeout: 25_000 });
    await seat.scrollIntoViewIfNeeded();
    await seat.hover({ timeout: 5_000 });

    // Hover-open: tooltip must appear.
    const tooltip = page.locator('.jets-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 5_000 });

    // The bridge: move the cursor onto the Cancel button. With the old code
    // the tooltip was already gone by this point; with the fix the deferred
    // close gets cancelled on mouseenter and the button is reachable.
    const cancelBtn = page.locator('.jets-cancel-btn');
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await cancelBtn.hover({ timeout: 5_000 });
    // Give the (now-cancelled) 80ms close timer time to fire if the fix
    // were broken. Tooltip should still be there.
    await page.waitForTimeout(200);
    await expect(tooltip).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // Click closes the tooltip — proves the click actually dispatched
    // against the live button, not against an already-removed DOM node.
    await cancelBtn.click({ timeout: 5_000 });
    await expect(tooltip).toBeHidden({ timeout: 5_000 });
  });

  test('moving back to the seat from the tooltip keeps it open', async ({ page }) => {
    // Companion case: the hover→tooltip→seat round-trip must not destroy
    // the tooltip either. Exercises `_showTooltip`'s cancel-pending-close
    // safeguard.
    await page.goto('/');
    await applyConfigAndReady(page, {
      builtInTooltip: true,
      tooltipOnHover: true,
    });

    const interactiveSeatSelector =
      '.jets-seat.jets-seat--available, ' +
      '.jets-seat.jets-seat--selected, ' +
      '.jets-seat.jets-seat--preferred, ' +
      '.jets-seat.jets-seat--extra';
    const seat = page.locator(interactiveSeatSelector).first();
    await seat.waitFor({ state: 'visible', timeout: 25_000 });
    await seat.scrollIntoViewIfNeeded();
    await seat.hover({ timeout: 5_000 });

    const tooltip = page.locator('.jets-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 5_000 });

    // Hover the tooltip body, then bounce back to the seat. The pending
    // close from "leave seat → schedule" must be cancelled by the
    // re-entering `_showTooltip`.
    await tooltip.hover({ timeout: 5_000 });
    await seat.hover({ timeout: 5_000 });
    await page.waitForTimeout(200);
    await expect(tooltip).toBeVisible();
  });
});
