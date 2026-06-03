import { expect, test } from '@playwright/test';
import { applyConfigAndReady, selectSeat } from '../helpers/demo';

/**
 * Asserts the shape of `tooltipRequested` payload — the data the lib hands
 * to integrators that build their own tooltip. The contract must match
 * React's `onTooltipRequested.seat`:
 *  - `features` carries only amenities (no pitch/width/recline)
 *  - `measurements` carries pitch/width/recline as its own array
 *  - every item has `key`, `icon` (full SVG string), `title`, `value`, `uniqId`
 *  - negative amenities carry `title: null` and the localized phrase in `value`
 *
 * The demo's `onTooltipRequested` handler stashes the latest payload on
 * `window.__lastTooltipRequest` (test-only seam) — we read it from there.
 */

const TARGET_SEAT = '43A';
// Force-available so the click reliably opens the tooltip across runs.
const AVAILABILITY = [{ label: '*', price: 29, currency: '$' }];

interface FeatureItem {
  key?: string;
  icon?: string;
  title?: string | null;
  value?: string | number | boolean | null;
  uniqId?: string;
}
interface CapturedSeat {
  features?: FeatureItem[];
  measurements?: FeatureItem[];
  [k: string]: unknown;
}
interface CapturedPayload {
  seat: CapturedSeat;
  element: unknown;
  event: unknown;
}

async function captureTooltipRequest(page: import('@playwright/test').Page): Promise<CapturedPayload> {
  const raw = await page.evaluate(() => {
    const w = window as Window & { __lastTooltipRequest?: unknown };
    // Strip non-serializable bits (DOM nodes, Event) so JSON crosses the bridge cleanly.
    const p = w.__lastTooltipRequest as { seat?: unknown; element?: unknown; event?: unknown } | undefined;
    if (!p) return null;
    return {
      seat: p.seat,
      element: p.element ? '<HTMLElement>' : null,
      event: p.event ? '<Event>' : null,
    };
  });
  if (!raw) throw new Error('No tooltipRequested payload captured');
  return raw as CapturedPayload;
}

test.describe('tooltipRequested payload', () => {
  test('seat carries split features/measurements with SVG icons', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {}, { availability: AVAILABILITY });
    await selectSeat(page, TARGET_SEAT);
    await page.locator('.jets-tooltip').first().waitFor({ state: 'visible', timeout: 10_000 });

    const payload = await captureTooltipRequest(page);
    const { seat } = payload;

    // — measurements should be a non-empty array (pitch + width + recline are common)
    expect(Array.isArray(seat.measurements)).toBe(true);
    expect((seat.measurements ?? []).length).toBeGreaterThan(0);

    const measurementKeys = (seat.measurements ?? []).map(m => m.key);
    // Different cabins surface different subsets, but pitch is universally present in demo.
    expect(measurementKeys).toContain('pitch');

    for (const m of seat.measurements ?? []) {
      expect(typeof m.icon).toBe('string');
      expect(m.icon!.startsWith('<svg')).toBe(true); // full inline SVG, not a key
      expect(typeof m.title).toBe('string'); // measurements always have a short title
      expect(m.value != null).toBe(true);
      expect(typeof m.uniqId).toBe('string');
    }

    // — features should contain amenities only, no pitch/width/recline leaking through
    expect(Array.isArray(seat.features)).toBe(true);
    const featureKeys = (seat.features ?? []).map(f => f.key);
    expect(featureKeys).not.toContain('pitch');
    expect(featureKeys).not.toContain('width');
    expect(featureKeys).not.toContain('recline');

    for (const f of seat.features ?? []) {
      expect(typeof f.icon).toBe('string');
      expect(f.icon!.startsWith('<svg')).toBe(true);
      expect(typeof f.uniqId).toBe('string');
    }
  });

  test('negative amenities carry title=null and localized text in value', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {}, { availability: AVAILABILITY });
    await selectSeat(page, TARGET_SEAT);
    await page.locator('.jets-tooltip').first().waitFor({ state: 'visible', timeout: 10_000 });

    const { seat } = await captureTooltipRequest(page);
    const negatives = (seat.features ?? []).filter(f => f.title === null);
    expect(negatives.length).toBeGreaterThan(0);

    for (const n of negatives) {
      // Localized phrase ('Close to lavatories', 'Stairs nearby', …) lives in `value`.
      expect(typeof n.value).toBe('string');
      expect((n.value as string).length).toBeGreaterThan(0);
    }
  });
});
