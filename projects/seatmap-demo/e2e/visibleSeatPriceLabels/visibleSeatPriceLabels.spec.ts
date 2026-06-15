import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotRows, screenshotSeatMap } from '../helpers/demo';

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
      await applyConfigAndReady(page, { visibleSeatPriceLabels: v.value }, { availability: AVAILABILITY });
      // Full deck shows the layout — handy for spotting that *no* pills exist
      // in the `false` variant — but the per-seat pill at full deck scale is
      // ~13×11 px. The zoom crop makes the on/off difference obvious.
      await screenshotSeatMap(page, __dirname, `visibleSeatPriceLabels-${v.name}`);
      await screenshotRows(page, __dirname, `visibleSeatPriceLabels-${v.name}-zoom`, 0, 3);
    });
  }
});
