import { test } from '@playwright/test';
import {
  applyConfigAndReady,
  screenshotRows,
  screenshotSeatMap,
  ConfigOverrides,
} from '../helpers/demo';

interface Variant {
  name: string;
  overrides: ConfigOverrides;
}

const VARIANTS: Variant[] = [
  {
    name: 'default',
    // Empty object (not `undefined`) so the demo's `{ ...base, ...override }` merge
    // actually clears qt888's pre-populated overrides — undefined gets stripped before
    // it reaches the merge. Falls back to the lib's locale cabin names.
    overrides: { visibleCabinTitles: true, customCabinTitles: {} },
  },
  {
    name: 'short',
    overrides: {
      visibleCabinTitles: true,
      customCabinTitles: { F: 'F', B: 'B', P: 'P', E: 'E' },
    },
  },
  {
    name: 'long',
    overrides: {
      visibleCabinTitles: true,
      // 'Premium Economy' is the differentiator from the default 'Premium' —
      // makes the long variant visually distinguishable from default.
      customCabinTitles: { F: 'First', B: 'Business', P: 'Premium Economy', E: 'Economy' },
    },
  },
];

test.describe('customCabinTitles', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, v.overrides);

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
