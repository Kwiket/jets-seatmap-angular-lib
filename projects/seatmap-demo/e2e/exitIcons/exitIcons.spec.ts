import { expect, test } from '@playwright/test';
import * as path from 'path';
import { waitForSeatMapReady } from '../helpers/demo';

/**
 * `colorTheme.exitIconUrlLeft` / `exitIconUrlRight` let consumers replace
 * the bundled exit-arrow SVGs with their own raster or SVG icons hosted at
 * an arbitrary URL.
 *
 * The bug we are guarding against: `JetsDeckExitComponent` used to read
 * only `exitColor` from `colorTheme` and rendered hard-coded inline SVGs,
 * so consumer-provided URLs were silently dropped.
 *
 * This spec reproduces the exact scenario from the bug report (UA953 with
 * the red icon URL) end-to-end:
 *   1. Open the demo, select the UA953 flight tab.
 *   2. Write the exact config JSON shown in the bug report into the INIT
 *      textarea — this includes `colorTheme.exitIconUrlLeft/Right`.
 *   3. Click INIT SEAT MAP and wait for the seatmap to (re)render.
 *   4. Assert both `.jets-exit--left` and `.jets-exit--right` render `<img>`
 *      elements whose `src` matches the URL we passed in.
 *   5. Save a full-page screenshot so the side-by-side artefact (config in
 *      the textarea + the applied icons on the seatmap) is preserved.
 */

const ICON_URL = 'https://panorama.quicket.io/icons/exit_icon_red.svg';

const CONFIG_JSON = {
  lang: 'EN',
  units: 'metric',
  builtInTooltip: true,
  builtInDeckSelector: true,
  singleDeckMode: true,
  visibleFuselage: true,
  visibleSeatPriceLabels: true,
  flatBulks: false,
  width: 380,
  colorTheme: {
    exitIconUrlLeft: ICON_URL,
    exitIconUrlRight: ICON_URL,
  },
};

test.describe('colorTheme: exitIconUrlLeft / exitIconUrlRight', () => {
  test('UA953 — custom exit icons render on both sides and full page screenshot is saved', async ({
    page,
  }) => {
    await page.goto('/');

    // Switch to UA953 flight tab — its baseline config has no custom exit
    // icons, so any icons we see in the screenshot must come from our override.
    await page
      .getByRole('button', { name: /UA953 · ORD → MUC/, exact: false })
      .click({ force: true });
    await waitForSeatMapReady(page);

    // Replace the INIT textarea with our config and re-init the seatmap.
    const initRow = page
      .getByRole('button', { name: 'INIT SEAT MAP', exact: true })
      .locator('xpath=ancestor::*[contains(@class,"demo-control-row")][1]');
    const initTextarea = initRow.locator('textarea.demo-control-textarea');
    const json = JSON.stringify(CONFIG_JSON, null, 2);
    await initTextarea.fill(json);
    await initTextarea.evaluate(el =>
      el.dispatchEvent(new Event('input', { bubbles: true })),
    );
    await page
      .getByRole('button', { name: 'INIT SEAT MAP', exact: true })
      .click({ force: true });
    await waitForSeatMapReady(page);

    // Pre-fetch the icon so the screenshot below is guaranteed to capture the
    // image bytes, not a broken-image placeholder.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      /* networkidle is best-effort under vite HMR */
    });

    // Assert both sides render <img> with the configured src.
    const leftImg = page.locator('.jets-exit--left img.jets-exit__icon').first();
    const rightImg = page.locator('.jets-exit--right img.jets-exit__icon').first();
    await expect(leftImg).toHaveAttribute('src', ICON_URL);
    await expect(rightImg).toHaveAttribute('src', ICON_URL);

    // The fallback inline SVG must NOT render when the URL is provided.
    expect(await page.locator('.jets-exit--left svg').count()).toBe(0);
    expect(await page.locator('.jets-exit--right svg').count()).toBe(0);

    // Confirm the browser actually loaded the image bytes (naturalWidth > 0)
    // — otherwise the screenshot would silently show a broken-image icon.
    // The icons are fetched over the network, so poll with a generous
    // timeout instead of a single read (Chromium fires `load` asynchronously
    // and the network is shared with the dev-server HMR socket).
    await expect
      .poll(
        () => leftImg.evaluate((el: HTMLImageElement) => el.naturalWidth),
        { timeout: 15_000, message: 'left exit icon failed to load' },
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        () => rightImg.evaluate((el: HTMLImageElement) => el.naturalWidth),
        { timeout: 15_000, message: 'right exit icon failed to load' },
      )
      .toBeGreaterThan(0);

    // Full-page screenshot: both the config we sent (visible in the textarea)
    // and the applied icons end up in a single artefact.
    const outPath = path.join(__dirname, 'screenshots', 'exitIcons-ua953-fullpage.png');
    await page.screenshot({ path: outPath, fullPage: true });
  });
});
