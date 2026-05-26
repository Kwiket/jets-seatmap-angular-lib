import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'true', value: true },
  { name: 'false', value: false },
] as const;

test.describe('visibleCabinTitles', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { visibleCabinTitles: v.value });
      await screenshotSeatMap(page, __dirname, `visibleCabinTitles-${v.name}`);
    });
  }
});
