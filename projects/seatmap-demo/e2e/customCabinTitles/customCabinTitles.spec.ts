import { expect, Page, test } from '@playwright/test';
import { applyConfigAndReady, screenshotRows, screenshotSeatMap, ConfigOverrides } from '../helpers/demo';

interface Variant {
  name: string;
  overrides: ConfigOverrides;
  expected: string[];
}

const VARIANTS: Variant[] = [
  {
    name: 'default',
    // Empty object (not `undefined`) so the demo's `{ ...base, ...override }` merge
    // actually clears qt888's pre-populated overrides — undefined gets stripped before
    // it reaches the merge. Falls back to the lib's locale cabin names.
    overrides: { visibleCabinTitles: true, customCabinTitles: {} },
    // EN locale fallback from constants.ts (LOCALES_MAP.EN).
    expected: ['First class', 'Business class', 'Premium class', 'Economy class'],
  },
  {
    name: 'short',
    overrides: {
      visibleCabinTitles: true,
      customCabinTitles: { F: 'F', B: 'B', P: 'P', E: 'E' },
    },
    expected: ['F', 'B', 'P', 'E'],
  },
  {
    name: 'long',
    overrides: {
      visibleCabinTitles: true,
      // 'Premium Economy' is the differentiator from the default 'Premium' —
      // makes the long variant visually distinguishable from default.
      customCabinTitles: { F: 'First', B: 'Business', P: 'Premium Economy', E: 'Economy' },
    },
    expected: ['First', 'Business', 'Premium Economy', 'Economy'],
  },
];

async function readCabinLabels(page: Page): Promise<string[]> {
  const raw = await page.locator('.jets-cabin-label__text').allInnerTexts();
  // Each cabin renders both a left- and a right-side label, so dedupe by trimmed text.
  return Array.from(new Set(raw.map(s => s.trim()).filter(Boolean)));
}

test.describe('customCabinTitles', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, v.overrides);

      const labels = await readCabinLabels(page);
      expect(labels.sort()).toEqual([...v.expected].sort());

      // Full deck for the broad layout. Cabin titles render vertically along
      // the seatmap edges — at full deck scale long strings like 'Premium Economy'
      // collapse into thin vertical noise indistinguishable from 'Premium'. Add
      // a zoomed crop of the front cabin so the first label is plainly
      // readable, with a wider pad to pull the side label into the clip.
      await screenshotSeatMap(page, __dirname, `customCabinTitles-${v.name}`);
      await screenshotRows(page, __dirname, `customCabinTitles-${v.name}-zoom`, 0, 4, {
        pad: 120,
      });
    });
  }
});
