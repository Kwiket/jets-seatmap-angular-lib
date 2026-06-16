/**
 * Side-by-side visual comparison harness for the WCAG feature-flags rollout.
 *
 * For each of the six demo flights, capture two screenshots:
 *   - `with-availability`: the demo's default availability payload
 *   - `without-availability`: the same flight with `availability = []`
 *
 * The output directory is controlled by `OUT_DIR` (env). Run the spec
 * twice — once on `origin/main` and once on `wcag-port-main` — pointing
 * each run at a different directory; downstream tooling builds the
 * side-by-side HTML page from the two sets.
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { applyConfigAndReady, setAvailability, waitForSeatMapReady } from '../helpers/demo';

const OUT_DIR = process.env['OUT_DIR'] || '/tmp/wcag-comparison/default';
// Three captures the same harness can produce, switched via env:
//   WCAG_PRESET=off  (or unset) — no WCAG config, behaves like main.
//   WCAG_PRESET=mid              — every flag on except `defaultColorTheme`
//                                  (a11y semantics + behaviour, legacy palette).
//   WCAG_PRESET=on               — `wcag.enabled = true` (all flags on,
//                                  including the AA palette).
const WCAG_PRESET = (process.env['WCAG_PRESET'] || 'off') as 'off' | 'mid' | 'on';
const EXTRA_CONFIG: Record<string, unknown> =
  WCAG_PRESET === 'on'
    ? { wcag: { enabled: true } }
    : WCAG_PRESET === 'mid'
      ? { wcag: { enabled: true, defaultColorTheme: false } }
      : {};

interface Flight {
  slug: string;
  // Partial label — the visible button text in the demo is
  // "<airline><no> · <dep> → <arr>"; we match by prefix to avoid pasting
  // the non-ASCII middle dot / arrow into source.
  tabPrefix: string;
}

const FLIGHTS: Flight[] = [
  { slug: 'QT888', tabPrefix: 'QT888' },
  { slug: 'UA953', tabPrefix: 'UA953' },
  { slug: 'QT777', tabPrefix: 'QT777' },
  { slug: 'DL898', tabPrefix: 'DL898' },
  { slug: 'AS1002', tabPrefix: 'AS1002' },
  { slug: 'LH470', tabPrefix: 'LH470' },
];

async function selectFlight(page: Page, prefix: string): Promise<void> {
  // Flight tabs live in the top-of-page <nav>. Match by visible prefix so
  // the non-ASCII separator / arrow chars don't need to be embedded here.
  await page.locator('nav button', { hasText: prefix }).first().click();
  await waitForSeatMapReady(page);
}

async function shot(page: Page, file: string): Promise<void> {
  const map = page.locator('.jets-seat-map').first();
  await map.scrollIntoViewIfNeeded();
  // Settle pending paint / scrollbar before capture.
  await page.waitForTimeout(300);
  await map.screenshot({ path: path.join(OUT_DIR, file) });
}

test.describe('snapshot comparison: every aircraft, with and without availability', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test('capture six flights × two availability states', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');
    // Wait for the initial seatmap render before clicking around.
    await waitForSeatMapReady(page);

    for (const flight of FLIGHTS) {
      // Clicking a flight tab resets the demo to that flight's defaults via
      // signals (incl. wiping any prior `wcag.*` overrides from the config
      // textarea). Re-apply the WCAG flag set after every tab click so the
      // requested flag state takes effect for the next two captures.
      await selectFlight(page, flight.tabPrefix);
      // applyConfigAndReady merges `EXTRA_CONFIG` into the textarea via
      // INIT SEAT MAP, then re-emits SET FLIGHT and SET AVAILABILITY using
      // whatever is in the availability textarea (set to DEFAULT_AVAILABILITY
      // by the flight-select effect) — equivalent to clicking those three
      // buttons in order. Only DL898 ships an availability in
      // flights.data.ts; for the rest this is how the "with availability"
      // capture gets a populated map.
      await applyConfigAndReady(page, EXTRA_CONFIG);
      await shot(page, `${flight.slug}-with-availability.png`);

      // Now strip availability and re-emit. The seatmap re-prepares with
      // an empty availability set — all seats render as unavailable.
      await setAvailability(page, []);
      await waitForSeatMapReady(page);
      await shot(page, `${flight.slug}-without-availability.png`);
    }

    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
    expect(files.length).toBeGreaterThanOrEqual(12);
  });
});
