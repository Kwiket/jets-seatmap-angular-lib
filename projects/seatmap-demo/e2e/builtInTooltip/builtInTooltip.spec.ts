import { test } from '@playwright/test';
import { applyConfigAndReady, clickFirstAvailableSeat, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'true', value: true },
  { name: 'false', value: false },
] as const;

test.describe('builtInTooltip', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, {
        builtInTooltip: v.value,
        tooltipOnHover: false,
      });
      await clickFirstAvailableSeat(page);
      await screenshotSeatMap(page, __dirname, `builtInTooltip-${v.name}`);
    });
  }
});
