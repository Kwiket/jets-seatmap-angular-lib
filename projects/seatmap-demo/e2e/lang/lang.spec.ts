import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = ['EN', 'DE', 'FR', 'ES'] as const;

test.describe('lang', () => {
  for (const lang of VARIANTS) {
    test(lang, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { lang });
      await screenshotSeatMap(page, __dirname, `lang-${lang}`);
    });
  }
});
