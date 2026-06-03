import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

const VARIANTS = [
  { name: 'none-hidden', hidden: [] as string[] },
  { name: 'all-hidden', hidden: ['noFloorStorage', 'nearLavatory', 'nearStairs'] },
  { name: 'partial-hidden', hidden: ['nearLavatory', 'nearGalley'] },
] as const;

// 43A is a front-cabin seat that consistently carries the features we care
// about for this test (extra legroom, no-floor-storage, tray-table) — clicking
// the same seat across all three variants keeps everything but the tooltip
// constant, so the screenshots differ only in which features got hidden.
// Using `clickFirstAvailableSeat` instead picked different seats across runs
// (e.g. 79E vs 43A), producing changes driven by seat identity, not config.
const TARGET_SEAT = '43A';

// `label: '*'` flags every seat as available, so 43A is always clickable
// regardless of what the sandbox API reports for the flight on a given day.
// Without this override the test flapped: 43A would occasionally render with
// `.jets-seat--unavailable`, the click wouldn't open a tooltip, and the test
// would time out.
const AVAILABILITY = [{ label: '*', price: 29, currency: '$' }];

test.describe('hiddenSeatFeatures', () => {
  for (const v of VARIANTS) {
    test(v.name, async ({ page }) => {
      await page.goto('/');
      await applyConfigAndReady(
        page,
        { hiddenSeatFeatures: [...v.hidden] },
        { availability: AVAILABILITY },
      );
      // Surface the tooltip — features list lives inside it. Wait for the
      // seat element, scroll it into view, then click. Without the explicit
      // wait+scroll, the click can race with the lib's late re-render and
      // miss the tooltip-mount handler.
      const seat = page.locator(`[data-seat-number="${TARGET_SEAT}"]`).first();
      await seat.waitFor({ state: 'visible', timeout: 10_000 });
      await seat.scrollIntoViewIfNeeded();
      await seat.click({ timeout: 5_000 });
      await page.locator('.jets-tooltip').first().waitFor({ state: 'visible', timeout: 10_000 });
      await screenshotSeatMap(page, __dirname, `hiddenSeatFeatures-${v.name}`);
    });
  }
});
