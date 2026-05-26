import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [200, 400, 600, 800] as const;

test.describe('width', () => {
  for (const w of VARIANTS) {
    test(`${w}`, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { width: w });
      await screenshotSeatMap(page, __dirname, `width-${w}`);
    });
  }
});
