import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'dollar', sign: '$' },
  { name: 'euro', sign: '€' },
  { name: 'pound', sign: '£' },
  { name: 'USD-truncated', sign: 'USD' },
] as const;

test.describe('currencySign', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, {
        visibleSeatPriceLabels: true,
        currencySign: v.sign,
      });
      await screenshotSeatMap(page, __dirname, `currencySign-${v.name}`);
    });
  }
});
