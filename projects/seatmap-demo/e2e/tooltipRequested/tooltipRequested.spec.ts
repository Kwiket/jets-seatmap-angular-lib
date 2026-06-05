import { expect, test } from '@playwright/test';
import * as path from 'path';
import { applyConfigAndReady, selectSeat } from '../helpers/demo';

/**
 * Asserts the shape of `tooltipRequested` payload — the data the lib hands to
 * integrators that build their own tooltip. The contract mirrors React's
 * `onTooltipRequested.seat` exactly:
 *  - `features` carries only amenities; pitch/width/recline go in `measurements`
 *  - every feature/measurement item has `key`, `icon` (full SVG string), `title`,
 *    `value`, `uniqId`
 *  - negative amenities carry `title: null` and the localized phrase in `value`
 *  - top-level seat is renamed `number → label`; layout-only fields stripped
 *  - `uniqId`, `classCode`, `seatType` (composite `${classCode}-${seatIconType}`)
 *    are populated on the seat itself
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
  uniqId?: string;
  label?: string;
  letter?: string;
  classCode?: string;
  classType?: string;
  seatType?: string;
  seatIconType?: number;
  status?: string;
  type?: string;
  features?: FeatureItem[];
  measurements?: FeatureItem[];
  number?: string;
  topOffset?: number;
  leftOffset?: number;
  size?: number;
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
    const p = w.__lastTooltipRequest as { seat?: unknown; element?: unknown; event?: unknown } | undefined;
    if (!p) return null;
    // Strip non-serializable bits (DOM nodes, Event) so JSON crosses the bridge cleanly.
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

    // — measurements split out into their own non-empty array
    expect(Array.isArray(seat.measurements)).toBe(true);
    expect((seat.measurements ?? []).length).toBeGreaterThan(0);
    const measurementKeys = (seat.measurements ?? []).map(m => m.key);
    expect(measurementKeys).toContain('pitch');

    for (const m of seat.measurements ?? []) {
      expect(typeof m.icon).toBe('string');
      expect(m.icon!.startsWith('<svg')).toBe(true);
      expect(typeof m.title).toBe('string');
      expect(m.value != null).toBe(true);
      expect(typeof m.uniqId).toBe('string');
    }

    // — features contains amenities only, never pitch/width/recline
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

    // — top-level seat: integrator-contract fields present, layout-only fields gone
    expect(typeof seat.uniqId).toBe('string');
    expect(typeof seat.label).toBe('string'); // renamed from `number`
    expect(typeof seat.classCode).toBe('string'); // single-letter ('E', 'B', …)
    expect(seat.classCode!.length).toBe(1);
    expect(typeof seat.classType).toBe('string'); // full word ('Economy', 'Business', …)
    expect(seat.classType!.length).toBeGreaterThan(1);
    expect(typeof seat.seatType).toBe('string'); // composite 'B-13' / 'E-5' / etc.
    expect(seat.seatType).toMatch(/^[A-Z]-\d+$/);
    // Contract: `color: string` (non-optional). Used to be undefined when the
    // availability entry had no colour — fixed in setAvailabilityHandler +
    // belt-and-braces fallback in _prepareSeatForEmit.
    expect(typeof seat.color).toBe('string');
    expect((seat.color as string).length).toBeGreaterThan(0);
    // passengerTypes is always an array (defaults to [] for unrestricted seats).
    expect(Array.isArray((seat as Record<string, unknown>)['passengerTypes'])).toBe(true);
    // No emitted key carries `undefined` — _prepareSeatForEmit strips them.
    for (const k of Object.keys(seat)) {
      expect((seat as Record<string, unknown>)[k]).toBeDefined();
    }
    // Layout-only fields stripped on emit:
    expect(seat.number).toBeUndefined();
    expect(seat.topOffset).toBeUndefined();
    expect(seat.leftOffset).toBeUndefined();
    expect(seat.size).toBeUndefined();
  });

  test('every amenity has string title + string value (negative ones carry localized text)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {}, { availability: AVAILABILITY });
    await selectSeat(page, TARGET_SEAT);
    await page.locator('.jets-tooltip').first().waitFor({ state: 'visible', timeout: 10_000 });

    const { seat } = await captureTooltipRequest(page);
    const features = seat.features ?? [];
    expect(features.length).toBeGreaterThan(0);

    // Integrator contract: ISeatFeature.{ title: string, value: string }. Internally
    // the lib still tracks negative amenities (those omitted from positive lookups);
    // on emit they flatten so title === value === localized phrase.
    for (const f of features) {
      expect(typeof f.title).toBe('string');
      expect((f.title as string).length).toBeGreaterThan(0);
      expect(typeof f.value).toBe('string');
      expect((f.value as string).length).toBeGreaterThan(0);
    }

    // At least one feature is the well-known 'Close to lavatories' negative on 43A.
    const lavatory = features.find(f => f.key === 'nearLavatory');
    expect(lavatory).toBeDefined();
    expect(lavatory!.title).toBe(lavatory!.value);
  });

  test('payload screenshot (DevTools-style tree for visual comparison with React reference)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {}, { availability: AVAILABILITY });
    await selectSeat(page, TARGET_SEAT);
    await page.locator('.jets-tooltip').first().waitFor({ state: 'visible', timeout: 10_000 });

    // Render a DevTools-like collapsed-object view of the payload into the page
    // and screenshot just that element. Truncate SVG/long strings so the image
    // mirrors the look of the React reference (which also truncates).
    await page.evaluate(() => {
      const w = window as Window & { __lastTooltipRequest?: unknown };
      const p = w.__lastTooltipRequest as { seat: Record<string, unknown> } | undefined;
      if (!p) return;

      const TRUNCATE = 60;
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const fmtValue = (v: unknown): string => {
        if (v === null) return `<span style="color:#cc7832">null</span>`;
        if (v === undefined) return `<span style="color:#cc7832">undefined</span>`;
        if (typeof v === 'boolean') return `<span style="color:#cc7832">${v}</span>`;
        if (typeof v === 'number') return `<span style="color:#6897bb">${v}</span>`;
        if (typeof v === 'string') {
          const truncated = v.length > TRUNCATE ? v.slice(0, TRUNCATE) + '...' : v;
          return `<span style="color:#6a8759">'${esc(truncated)}'</span>`;
        }
        if (Array.isArray(v)) return `Array(${v.length})`;
        return typeof v;
      };

      // Render one object on one line — keys highlighted, values colored.
      // Mirrors DevTools collapsed-object view that the React reference uses.
      const renderItem = (obj: Record<string, unknown>): string => {
        const parts = Object.entries(obj).map(([k, v]) => {
          return `<span style="color:#9876aa">${esc(k)}</span>: ${fmtValue(v)}`;
        });
        return `{${parts.join(', ')}}`;
      };

      const lines: string[] = [];
      lines.push(`<span style="color:#a9b7c6">Tooltip requested:</span>`);
      lines.push(
        `<span style="color:#808080">▼ {seat: {…}, element: div.jets-seat.jets-seat--available, event: MouseEvent}</span>`
      );
      lines.push(`  <span style="color:#808080">▼</span> <span style="color:#9876aa">seat</span>:`);

      const seat = p.seat;
      for (const [k, v] of Object.entries(seat)) {
        if (Array.isArray(v)) {
          lines.push(
            `    <span style="color:#808080">▼</span> <span style="color:#9876aa">${esc(k)}</span>: Array(${v.length})`
          );
          v.forEach((item, idx) => {
            if (item && typeof item === 'object') {
              lines.push(
                `      <span style="color:#808080">▶</span> <span style="color:#6897bb">${idx}</span>: ${renderItem(item as Record<string, unknown>)}`
              );
            } else {
              lines.push(`      <span style="color:#6897bb">${idx}</span>: ${fmtValue(item)}`);
            }
          });
          lines.push(`      <span style="color:#9876aa">length</span>: ${v.length}`);
        } else {
          lines.push(`    <span style="color:#9876aa">${esc(k)}</span>: ${fmtValue(v)}`);
        }
      }

      const host = document.createElement('div');
      host.id = '__payload-viewer';
      host.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'z-index:99999',
        'background:#1e1f22',
        'color:#bcbec4',
        'font:14px/1.55 "SF Mono", "Menlo", ui-monospace, monospace',
        'padding:16px 22px',
        'white-space:pre',
        'border:1px solid #313338',
      ].join(';');
      host.innerHTML = lines.join('\n');
      document.body.appendChild(host);
    });

    const viewer = page.locator('#__payload-viewer');
    await viewer.waitFor({ state: 'visible' });
    const outPath = path.join(__dirname, 'screenshots', 'tooltipRequested-payload.png');
    await viewer.screenshot({ path: outPath });

    // Sanity: the screenshot must exist and the viewer's text must mention 'measurements:'.
    const text = await viewer.textContent();
    expect(text).toContain('measurements:');
    expect(text).toContain('features:');
    expect(text).toContain('label:');
    expect(text).toContain('classCode:');
    expect(text).toContain('seatType:');
    expect(text).toContain('uniqId:');
  });
});
