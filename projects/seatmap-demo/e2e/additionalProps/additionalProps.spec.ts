import { expect, test } from '@playwright/test';
import * as path from 'path';
import { applyConfigAndReady, clickButton, selectSeat } from '../helpers/demo';

/**
 * Locks in React-parity for `availability[].additionalProps` — integrator-
 * defined extra rows that don't come from the seatmap API.
 *
 * The default demo availability gives 20A two such props (a dot-icon row and
 * a wifi-icon row). React renders both inside the tooltip's amenities list;
 * Angular used to drop them silently (preparer was wired up but not called
 * by `setAvailabilityHandler`, and the tooltip's `amenities` getter ignored
 * `seat.additionalProps`). This spec asserts:
 *
 *  1. Both rows appear in the rendered tooltip alongside the API amenities.
 *  2. The `tooltipRequested.seat.additionalProps` payload carries them with
 *     the prepared `ISeatFeature` shape (`title === ''`, non-empty `uniqId`,
 *     resolved SVG `icon`).
 *  3. A parity-proof screenshot of the tooltip lands in `screenshots/`.
 */

const TARGET_SEAT = '20A';
const AVAILABILITY = [
  {
    currency: 'USD',
    label: '20A',
    price: 33,
    onlyForPassengerType: ['ADT', 'CHD', 'INF'],
    additionalProps: [
      { label: 'Test prop for all', icon: null },
      { label: 'Another test prop for all', icon: 'wifi' },
    ],
    color: 'green',
  },
];

interface FeatureItem {
  uniqId?: string;
  icon?: string;
  title?: string | null;
  value?: string | number | boolean | null;
  cssClass?: string;
}
interface CapturedSeat {
  label?: string;
  additionalProps?: FeatureItem[];
  features?: FeatureItem[];
  [k: string]: unknown;
}

async function captureSeat(page: import('@playwright/test').Page): Promise<CapturedSeat> {
  const raw = await page.evaluate(() => {
    const w = window as Window & { __lastTooltipRequest?: { seat?: unknown } };
    return w.__lastTooltipRequest?.seat ?? null;
  });
  if (!raw) throw new Error('No tooltipRequested payload captured');
  return raw as CapturedSeat;
}

test.describe('availability.additionalProps render parity', () => {
  test('renders integrator-defined props in tooltip and emits them on tooltipRequested', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {}, { availability: AVAILABILITY });
    // The default deck shown is index 0 (rear cabin, rows 43+); 20A lives on
    // the next deck. Flip via SET DECK before clicking the target seat.
    const deckTextarea = page.getByRole('button', { name: 'SET DECK', exact: true })
      .locator('xpath=ancestor::*[contains(@class,"demo-control-row")][1]')
      .locator('textarea.demo-control-textarea');
    await deckTextarea.fill('1');
    await deckTextarea.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
    await clickButton(page, 'SET DECK');
    await page.waitForTimeout(800);
    await selectSeat(page, TARGET_SEAT);
    await page.locator('.jets-tooltip').first().waitFor({ state: 'visible', timeout: 10_000 });

    // 1. Rendered tooltip carries both rows.
    const labels = await page.locator('.jets-tooltip--amenity-text').allInnerTexts();
    expect(labels).toContain('Test prop for all');
    expect(labels).toContain('Another test prop for all');

    // 2. Emit payload carries the prepared shape.
    const seat = await captureSeat(page);
    expect(seat.label).toBe(TARGET_SEAT);
    expect(seat.additionalProps).toBeDefined();
    expect(seat.additionalProps!.length).toBe(2);
    for (const ap of seat.additionalProps!) {
      // Integrator-defined rows carry an empty title (not null) — keeps the
      // tooltip's negative-amenity styling off and round-trips through
      // `_prepareSeatForEmit`'s `normalizeFeature` as a no-op.
      expect(ap.title).toBe('');
      expect(typeof ap.uniqId).toBe('string');
      expect(ap.uniqId!.length).toBeGreaterThan(0);
      expect(typeof ap.icon).toBe('string');
      expect(ap.icon!.length).toBeGreaterThan(0);
    }
    expect(seat.additionalProps![0].value).toBe('Test prop for all');
    expect(seat.additionalProps![1].value).toBe('Another test prop for all');

    // 3. Parity-proof screenshots.
    const outDir = path.join(__dirname, 'screenshots');
    await page.screenshot({ path: path.join(outDir, 'additionalProps-tooltip.png'), fullPage: false });
    // Wider shot to mirror the demo layout the user gets when integrating
    // the lib — tooltip on the left, availability JSON on the right.
    await page.screenshot({ path: path.join(outDir, 'additionalProps-page.png'), fullPage: true });
  });
});
