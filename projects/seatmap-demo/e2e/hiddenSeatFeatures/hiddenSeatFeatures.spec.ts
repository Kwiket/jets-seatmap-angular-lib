import { test } from '@playwright/test';
import { applyConfigAndReady, clickFirstAvailableSeat, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'none-hidden', hidden: [] as string[] },
  { name: 'all-hidden', hidden: ['noFloorStorage', 'nearLavatory', 'nearStairs'] },
  { name: 'partial-hidden', hidden: ['nearLavatory', 'nearGalley'] },
] as const;

test.describe('hiddenSeatFeatures', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(page, { hiddenSeatFeatures: [...v.hidden] });
      // Surface the tooltip — features list lives inside it.
      await clickFirstAvailableSeat(page);
      await screenshotSeatMap(page, __dirname, `hiddenSeatFeatures-${v.name}`);
    });
  }
});
