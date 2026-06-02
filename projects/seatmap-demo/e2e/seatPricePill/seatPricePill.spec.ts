import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotRows } from '../helpers/demo';

/**
 * Zoom screenshots of a single row that focus on the per-seat price pill —
 * the full-deck baselines (visibleSeatPriceLabels, currencySign) shrink the
 * pill down to ~13×11 px which is visually indistinguishable on the rendered
 * PNG. These crops capture three rows so the white pill above each available
 * seat is clearly readable.
 */
const AVAILABILITY = [{ label: '*', price: 29, currency: '$' }];

const VARIANTS = [
  { name: 'dollar', sign: '$' },
  { name: 'euro', sign: '€' },
  { name: 'pound', sign: '£' },
] as const;

test.describe('seatPricePill', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(
        page,
        { visibleSeatPriceLabels: true, currencySign: v.sign },
        { availability: AVAILABILITY },
      );
      // Rows 0..2 land in the front cabin — good readable seats at full size.
      await screenshotRows(page, __dirname, `seatPricePill-${v.name}`, 0, 3);
    });
  }
});
