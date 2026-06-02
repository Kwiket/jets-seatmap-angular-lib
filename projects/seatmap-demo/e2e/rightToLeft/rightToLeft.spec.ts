import { test } from '@playwright/test';
import {
  applyConfigAndReady,
  clickFirstAvailableSeat,
  screenshotSeatMap,
} from '../helpers/demo';

const VARIANTS = [
  { name: 'true', value: true },
  { name: 'false', value: false },
] as const;

test.describe('rightToLeft', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { rightToLeft: v.value });
      await screenshotSeatMap(page, __dirname, `rightToLeft-${v.name}`);
    });

    // Open a tooltip — RTL applies `direction: rtl` only to tooltip header
    // and amenities list, so this is where the visual difference shows up.
    test(`${v.name}-tooltip`, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { rightToLeft: v.value });
      await clickFirstAvailableSeat(page);
      await screenshotSeatMap(page, __dirname, `rightToLeft-${v.name}-tooltip`);
    });
  }
});
