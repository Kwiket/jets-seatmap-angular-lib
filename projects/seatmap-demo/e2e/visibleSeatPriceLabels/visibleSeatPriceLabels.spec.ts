import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'true', value: true },
  { name: 'false', value: false },
] as const;

// Availability covers every seat with a fixed price so the pill renders
// for the `true` variant. Without it `data.price` is undefined and the
// pill is suppressed regardless of the flag. The currency symbol uses
// '$' (single char) — React's SeatPriceLabel takes the first character
// of the currency string, so multi-char codes ('USD') would render 'U'.
const AVAILABILITY = [{ label: '*', price: 29, currency: '$' }];

test.describe('visibleSeatPriceLabels', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(
        page,
        { visibleSeatPriceLabels: v.value },
        { availability: AVAILABILITY },
      );
      await screenshotSeatMap(page, __dirname, `visibleSeatPriceLabels-${v.name}`);
    });
  }
});
