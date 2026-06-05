import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotRows, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'dollar', sign: '$' },
  { name: 'euro', sign: '€' },
  { name: 'pound', sign: '£' },
  { name: 'USD-truncated', sign: 'USD' },
] as const;

// Availability is required so seats carry a `price` and the pill renders.
// Without it currencySign has nothing to show on the screenshot. The
// currencySign config field overrides the per-seat currency, so the
// availability value here only matters for the price (29).
const AVAILABILITY = [{ label: '*', price: 29, currency: '$' }];

test.describe('currencySign', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(
        page,
        { visibleSeatPriceLabels: true, currencySign: v.sign },
        { availability: AVAILABILITY },
      );
      // Full deck shows the broad layout, but the pill is ~13×11 px at this
      // scale — the symbol is unreadable. Capture a zoomed crop of the first
      // few rows so each variant's currency glyph is plainly visible.
      await screenshotSeatMap(page, __dirname, `currencySign-${v.name}`);
      await screenshotRows(page, __dirname, `currencySign-${v.name}-zoom`, 0, 3);
    });
  }
});
