import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'dollar', sign: '$' },
  { name: 'euro', sign: '€' },
  { name: 'pound', sign: '£' },
  { name: 'USD-truncated', sign: 'USD' },
] as const;

// Availability is required so seats carry a `price` and the pill renders.
// Without it currencySign has nothing to show on the screenshot.
const AVAILABILITY = [{ label: '*', price: 29, currency: 'USD' }];

test.describe('currencySign', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(
        page,
        { visibleSeatPriceLabels: true, currencySign: v.sign },
        { availability: AVAILABILITY },
      );
      await screenshotSeatMap(page, __dirname, `currencySign-${v.name}`);
    });
  }
});
