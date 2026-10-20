import { expect, test, type Page } from '@playwright/test';
import { screenshotSeatMap, waitForSeatMapReady } from '../helpers/demo';

/**
 * The preset `colorTheme` values the library exports, picked from the demo's
 * "Color theme" select. Each preset gets a screenshot under
 * `presetThemes/screenshots/presetThemes-<key>.png`, plus a DOM check that the
 * seats really took the preset's colours.
 */

interface PresetCase {
  key: string;
  /** Colours at least one rendered seat must carry. */
  seatColors: string[];
}

const PRESETS: PresetCase[] = [
  { key: 'default', seatColors: [] },
  { key: 'bw', seatColors: ['#ffffff'] },
  { key: 'light-blue', seatColors: ['#a8d4f0'] },
  { key: 'dark', seatColors: ['#3e455d'] },
  { key: 'lopa', seatColors: ['#5d6385'] },
  // Economy navy plus the business violet of the demo's first flight.
  { key: 'cabins-diff', seatColors: ['#27315f', '#7040cc'] },
];

function countSeatFills(page: Page, colors: string[]) {
  return page.evaluate((cs: string[]) => {
    const seats = Array.from(document.querySelectorAll('.jets-seat__svg svg')) as SVGElement[];
    const hits: Record<string, number> = {};
    for (const c of cs) hits[c] = 0;
    for (const svg of seats) {
      const html = svg.outerHTML.toLowerCase();
      for (const c of cs) {
        if (html.includes(`fill="${c}"`)) hits[c]++;
      }
    }
    return hits;
  }, colors);
}

test.describe('preset color themes', () => {
  for (const p of PRESETS) {
    test(p.key, async ({ page }) => {
      await page.goto('/');
      await waitForSeatMapReady(page);
      await page.locator('.demo-theme-select').selectOption(p.key);
      await waitForSeatMapReady(page);

      const hits = await countSeatFills(page, p.seatColors);
      for (const c of p.seatColors) {
        expect(hits[c], `expected ≥1 seat filled ${c} in ${p.key}, got ${JSON.stringify(hits)}`).toBeGreaterThan(0);
      }
      await screenshotSeatMap(page, __dirname, `presetThemes-${p.key}`);
    });
  }
});
