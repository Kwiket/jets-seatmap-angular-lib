import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'true', value: true },
  { name: 'false', value: false },
] as const;

test.describe('builtInDeckSelector', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { builtInDeckSelector: v.value });
      await screenshotSeatMap(page, __dirname, `builtInDeckSelector-${v.name}`);
    });
  }
});
