/**
 * Screenshot harness — NOT an assertion test. Emulates the demo app's four
 * colour-mode toggles using the library's data-driven config options, so each
 * screenshot shows exactly what the demo renders for that flag combination:
 *
 *   demo toggle state            library config that produces it
 *   ─────────────────────────    ──────────────────────────────────────────
 *   Score OFF, Class OFF      ->  colorTheme.seatAvailableColor  (one flat colour)
 *   Score ON,  Class OFF      ->  colorTheme.customSeatColorRanges (score palette)
 *   Score OFF, Class ON       ->  colorTheme.customSeatColorClasses (per-class palette)
 *   Score ON,  Class ON       ->  ranges + classes (score wins; class fills the rest)
 *
 * All seats are rendered available (`availability: []`) so the colours are
 * visible across the whole cabin. Run with the dev demo on :4201:
 *   PW_BASE_URL=http://localhost:4201 npx playwright test \
 *     --config projects/seatmap-demo/e2e/playwright.config.ts \
 *     seatColorModes.screenshots --workers=1
 * Output: projects/seatmap-demo/e2e/seatColors/screenshots/<name>.png
 */
import { test } from '@playwright/test';
import * as path from 'path';
import { applyConfigAndReady, type ConfigOverrides } from '../helpers/demo';

// Realistic score palette (matches the demo's qt888 customSeatColorRanges).
const RANGES = [
  { color: '#c7683d', range: [1, 2.99] },
  { color: '#e6be3f', range: [3, 4.99] },
  { color: '#4071b9', range: [5, 6.5] },
  { color: '#8fb947', range: [6.51, 10] },
];

// Vivid, deliberately distinct per-class colours so the cabins read clearly:
// First / Business / Premium / Economy / All.
const CLASSES = { F: '#d11149', B: '#ff7f0e', P: '#2ca02c', E: '#1f77b4', A: '#7f3fbf' };

// A single flat colour for the "both off" mode — one theme colour for every seat.
const FLAT = '#6b7a8f';

// The demo's visual theme (floor, fuselage, stroke, fonts) so each screenshot
// looks like the real app. Each mode's colorTheme replaces the demo's baked-in
// one (shallow merge), so we re-supply these and add only the mode's colour keys.
const BASE_THEME: ConfigOverrides = {
  seatMapBackgroundColor: '#fff',
  floorColor: '#595959',
  deckLabelTitleColor: 'black',
  seatStrokeColor: 'rgb(230, 230, 230)',
  seatArmrestColor: '#cccccc',
  notAvailableSeatsColor: 'dimgrey',
  fuselageStrokeWidth: 10,
  fuselageFillColor: 'lightgrey',
  fuselageStrokeColor: 'darkgrey',
  fuselageWindowsColor: 'darkgrey',
  fontFamily: 'Montserrat, sans-serif',
  cabinTitlesWidth: 85,
};

const OUT_DIR = path.join(__dirname, 'screenshots');

const MODES: Array<{ file: string; theme: ConfigOverrides }> = [
  { file: 'mode-1_score-OFF_class-OFF_(seatAvailableColor).png', theme: { ...BASE_THEME, seatAvailableColor: FLAT } },
  {
    file: 'mode-2_score-ON_class-OFF_(customSeatColorRanges).png',
    theme: { ...BASE_THEME, customSeatColorRanges: RANGES },
  },
  {
    file: 'mode-3_score-OFF_class-ON_(customSeatColorClasses).png',
    theme: { ...BASE_THEME, customSeatColorClasses: CLASSES },
  },
  {
    file: 'mode-4_score-ON_class-ON_(ranges+classes_score-wins).png',
    theme: { ...BASE_THEME, customSeatColorRanges: RANGES, customSeatColorClasses: CLASSES },
  },
];

test.describe('seat colour modes — demo emulation screenshots', () => {
  for (const mode of MODES) {
    test(`screenshot: ${mode.file}`, async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 1400 });
      await page.goto('/');
      await applyConfigAndReady(
        page,
        { horizontal: false, visibleFuselage: true, visibleCabinTitles: true, colorTheme: mode.theme },
        { availability: [] }
      );
      await page.waitForTimeout(400);
      await page
        .locator('.demo-seatmap-wrapper')
        .first()
        .screenshot({ path: path.join(OUT_DIR, mode.file) });
    });
  }
});
