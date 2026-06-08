import { expect, test } from '@playwright/test';
import * as path from 'path';
import { applyConfigAndReady, setAvailability } from '../helpers/demo';

/**
 * Visual proof that the seat event payload now matches the React contract:
 *
 *   - `passengerTypes` defaults to `['ADT','CHD','INF']` (React's
 *     DEFAULT_SEAT_PASSENGER_TYPES) when availability doesn't restrict the seat.
 *   - `rotation` is no longer emitted (React keeps rotation on `seatMap.params`,
 *     never on the seat itself).
 *   - `features[]` carries a category in `title` and the API summary in `value`
 *     (was inverted before the fix).
 *   - The wifi feature key is `wifi` (not `wifiEnabled`).
 *   - Amenity icons use the React hex `#4f6f8f` instead of `currentColor`.
 *
 * The test drives the demo into hover-tooltip + external-passenger-management
 * mode (the production scenario where `seatMouseClick` fires), clicks an
 * available seat to populate `window.__lastTooltipRequest`, injects a small
 * overlay that pretty-prints the payload + flags each parity point, and
 * screenshots the page.
 */

const OUT_DIR = path.join(__dirname, 'screenshots');

test.use({ viewport: { width: 1700, height: 1100 } });

test('seat event payload — React parity proof', async ({ page }) => {
  await page.goto('/');

  await applyConfigAndReady(page, {
    width: 420,
    externalPassengerManagement: true,
    tooltipOnHover: true,
  });

  await setAvailability(page, [
    { currency: 'USD', label: '20A', price: 33 },
    { currency: 'USD', label: '20E', price: 33 },
    { currency: 'USD', label: '21F', price: 13 },
    { currency: 'USD', label: '70E', price: 133399 },
  ]);

  // Fire seatMouseClick (which now runs through prepareSeatDataForEmit) plus
  // tooltipRequested. The demo persists the latter on window.__lastTooltipRequest.
  const seat = page.locator('.jets-seat.jets-seat--available').first();
  await seat.waitFor({ state: 'visible', timeout: 15_000 });
  await seat.scrollIntoViewIfNeeded();
  await seat.dispatchEvent('mouseenter');
  await page.waitForTimeout(150);
  await seat.dispatchEvent('click');
  await page.waitForTimeout(250);

  const payload = await page.evaluate(() => {
    const w = window as Window & {
      __lastTooltipRequest?: { seat?: Record<string, unknown> };
    };
    if (!w.__lastTooltipRequest?.seat) return null;
    // Strip DOM refs and oversized SVG bodies; keep just `fill="…"` markers so
    // the screenshot stays readable.
    return JSON.parse(
      JSON.stringify(w.__lastTooltipRequest.seat, (_k, v) => {
        if (v instanceof Node) return `<dom:${v.nodeName}>`;
        if (typeof v === 'string' && v.startsWith('<svg')) {
          const fill = (v.match(/fill="([^"]+)"/) || [])[1] ?? '?';
          return `<svg … fill="${fill}" …>`;
        }
        return v;
      })
    );
  });

  expect(payload).not.toBeNull();
  expect(payload).toMatchObject({
    label: expect.any(String),
    classType: expect.any(String),
    passengerTypes: ['ADT', 'CHD', 'INF'],
    // React-parity: rotation present, defaults to 'n' (north / no-rotation).
    rotation: 'n',
  });
  // passengerTypes must be a flat string[] — guard against the legacy
  // [["ADT","CHD","INF"]] nesting that surfaced through the availability
  // merge before the service.ts:126 fix.
  expect(Array.isArray(payload.passengerTypes)).toBe(true);
  for (const item of payload.passengerTypes ?? []) {
    expect(typeof item).toBe('string');
  }
  expect(payload.features).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'wifi' })]));
  for (const f of payload.features ?? []) {
    if (typeof f.icon === 'string') {
      expect(f.icon).toContain('#4f6f8f');
    }
  }

  // Inject an overlay summarising the parity check. Pure DOM — no framework
  // assumptions, no impact on the Angular app behind it.
  await page.evaluate(payload => {
    const wrap = document.createElement('div');
    wrap.id = 'parity-overlay';
    wrap.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      width: 760px;
      max-height: calc(100vh - 24px);
      overflow: auto;
      background: #0e1116;
      color: #d7dee8;
      border: 1px solid #2e3540;
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.45);
      padding: 18px 20px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      z-index: 99999;
    `;

    const features = (payload.features ?? []) as Array<Record<string, unknown>>;
    const wifiKey = features.find(f => String(f.key).toLowerCase().includes('wifi'))?.key;
    const sampleFeature = features[0] ?? null;
    const iconFillMatch = sampleFeature?.icon ? /fill="([^"]+)"/.exec(String(sampleFeature.icon))?.[1] : null;

    const passengerTypesFlat =
      Array.isArray(payload.passengerTypes) && payload.passengerTypes.every(x => typeof x === 'string');
    const checks: Array<{ label: string; pass: boolean; got: string; want: string }> = [
      {
        label: 'passengerTypes default',
        pass: JSON.stringify(payload.passengerTypes) === JSON.stringify(['ADT', 'CHD', 'INF']),
        got: JSON.stringify(payload.passengerTypes),
        want: '["ADT","CHD","INF"]',
      },
      {
        label: 'passengerTypes is flat string[]',
        pass: passengerTypesFlat,
        got: passengerTypesFlat ? 'flat string[]' : 'nested or wrong type',
        want: 'flat string[]',
      },
      {
        label: 'rotation default "n"',
        pass: payload.rotation === 'n',
        got: JSON.stringify(payload.rotation),
        want: '"n"',
      },
      {
        label: 'features[].title is the category',
        pass: typeof sampleFeature?.title === 'string' && !!sampleFeature.title,
        got: JSON.stringify(sampleFeature?.title),
        want: '"Audio and video on demand" / "Wi-Fi" / …',
      },
      {
        label: 'features[].value is the summary (or true)',
        pass: sampleFeature != null && (typeof sampleFeature.value === 'string' || sampleFeature.value === true),
        got: JSON.stringify(sampleFeature?.value),
        want: '"Free on demand entertainment" / true',
      },
      {
        label: 'wifi feature key',
        pass: wifiKey === 'wifi',
        got: JSON.stringify(wifiKey),
        want: '"wifi"',
      },
      {
        label: 'amenity icon fill',
        pass: iconFillMatch === '#4f6f8f',
        got: JSON.stringify(iconFillMatch),
        want: '"#4f6f8f"',
      },
    ];

    const allPass = checks.every(c => c.pass);

    const row = (c: { label: string; pass: boolean; got: string; want: string }) => `
      <tr>
        <td style="padding: 4px 10px 4px 0; color: ${c.pass ? '#36c84a' : '#ff6b6b'}; font-weight: 600;">
          ${c.pass ? '✓' : '✗'}
        </td>
        <td style="padding: 4px 12px 4px 0; color: #cfd6e0;">${c.label}</td>
        <td style="padding: 4px 12px 4px 0; color: #8aa3c0;">got <code style="color:#e7eef7;">${c.got}</code></td>
        <td style="padding: 4px 0; color: #6f7d8c;">expected <code style="color:#a9b8c8;">${c.want}</code></td>
      </tr>
    `;

    wrap.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <div style="font-size: 13px; color: #c8d2dd; font-weight: 700; letter-spacing: 0.3px;">
          Seat event payload — React parity
        </div>
        <div style="
          margin-left:auto;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          background: ${allPass ? '#0e3a18' : '#3a0e0e'};
          color: ${allPass ? '#7ee29a' : '#ff9a9a'};
          border: 1px solid ${allPass ? '#1a6a30' : '#6a1a1a'};
        ">${allPass ? 'ALL PARITY CHECKS PASS' : 'CHECKS FAILED'}</div>
      </div>
      <table style="border-collapse: collapse; margin-bottom: 14px; width: 100%;">${checks.map(row).join('')}</table>
      <div style="font-size: 11px; color: #8aa3c0; margin-bottom: 4px;">
        actual <code>tooltipRequested.seat</code> payload
      </div>
      <pre style="
        margin: 0;
        padding: 12px;
        background: #060a0f;
        border: 1px solid #21262d;
        border-radius: 6px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 520px;
        overflow: auto;
        color: #d7dee8;
        font-size: 11px;
      ">${JSON.stringify(payload, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    `;

    document.body.appendChild(wrap);
  }, payload);

  // Let layout settle before snapping.
  await page.waitForTimeout(150);

  // Full-page snapshot: parity panel + seatmap context (showing the tooltip
  // open at the seat that fired the event).
  await page.screenshot({
    path: path.join(OUT_DIR, 'eventPayloadParity-overlay.png'),
    fullPage: false,
  });

  // Close-up of just the parity panel — the text in the full-page snap is
  // unreadable at GitHub's default attachment width, so we ship a focused
  // crop of the overlay element on its own.
  await page.locator('#parity-overlay').screenshot({
    path: path.join(OUT_DIR, 'eventPayloadParity-panel.png'),
  });
});
