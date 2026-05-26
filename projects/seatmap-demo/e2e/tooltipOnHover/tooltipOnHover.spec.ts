import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'true', value: true },
  { name: 'false', value: false },
] as const;

test.describe('tooltipOnHover', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, {
        builtInTooltip: true,
        tooltipOnHover: v.value,
      });
      // Hover (not click) over an available seat. On `true` this should open
      // the tooltip; on `false` it should not.
      const seat = page.locator('.jets-seat--available[data-seat-number]').first();
      await seat.hover();
      await page.waitForTimeout(250);
      await screenshotSeatMap(page, __dirname, `tooltipOnHover-${v.name}`);
    });
  }
});
