import { expect, test } from '@playwright/test';
import * as path from 'path';
import { applyConfigAndReady } from '../helpers/demo';

/**
 * Visual proof that the `seatMapInited` (a.k.a. `onSeatMapInited`) payload now
 * matches the React contract:
 *
 *   - `heightInPx` / `widthInPx` are NATIVE (unscaled) — multiplying each by
 *     `scaleFactor` reproduces the rendered DOM size. When `scaleFactor === 1`
 *     the values are the rendered pixel sizes 1:1.
 *   - `availabilityData` key is always present (mirrors React); `undefined`
 *     when no `availability` Input is provided.
 *   - `error` key is OMITTED when there is no error (React parity — previously
 *     Angular always emitted `error: undefined`).
 *   - Legacy Angular-only fields `availableSeats`, `allSeats`,
 *     `availableCabins` are gone. The single bookkeeping field is `allCabins`
 *     (renamed from `availableCabins` — the data is "all cabins detected in
 *     the source", not just the available ones).
 *
 * The demo exposes the most recent payload on `window.__lastSeatMapInited`
 * (mirrors the `__lastTooltipRequest` test seam). We boot the demo, snapshot
 * the payload, render an overlay flagging each parity check, screenshot.
 */

const OUT_DIR = path.join(__dirname, 'screenshots');

test.use({ viewport: { width: 1700, height: 1100 } });

test('seatMapInited payload — React parity proof', async ({ page }) => {
  await page.goto('/');

  await applyConfigAndReady(page, { width: 380 });

  // Wait for the init payload to actually land on the window seam — the
  // demo writes it inside the seatMapInited handler, which fires after the
  // setTimeout(0) the library uses to measure DOM.
  await page.waitForFunction(
    () => (window as Window & { __lastSeatMapInited?: unknown }).__lastSeatMapInited != null,
    null,
    { timeout: 25_000 },
  );

  const captured = await page.evaluate(() => {
    const w = window as Window & { __lastSeatMapInited?: Record<string, unknown> };
    const raw = w.__lastSeatMapInited!;
    // Independent measurement of the rendered DOM. Used to verify the
    // invariant `native × scaleFactor === actual rendered pixels`.
    const container = document.querySelector('.jets-seat-map') as HTMLElement | null;
    const deck = document.querySelector(
      `.deck-wrapper[data-deck-index="${raw['currentDeckIndex'] ?? 0}"]`,
    ) as HTMLElement | null;
    const renderedHeight = (deck ?? container)?.getBoundingClientRect().height ?? 0;
    const renderedWidth = container?.getBoundingClientRect().width ?? 0;

    // Strip non-serialisable refs / oversized SVG bodies before returning.
    const payload = JSON.parse(
      JSON.stringify(raw, (_k, v) => {
        if (v instanceof Node) return `<dom:${v.nodeName}>`;
        if (typeof v === 'string' && v.startsWith('<svg')) {
          const fill = (v.match(/fill="([^"]+)"/) || [])[1] ?? '?';
          return `<svg … fill="${fill}" …>`;
        }
        return v;
      }),
    );

    // Record which keys are PRESENT on the raw payload (after JSON.stringify
    // an `undefined` value drops the key, so we capture this from the live
    // object before serialisation).
    const keys = Object.keys(raw);

    return { payload, keys, renderedHeight, renderedWidth };
  });

  // ─── Assertions ────────────────────────────────────────────────────
  const { payload, keys, renderedHeight, renderedWidth } = captured;

  expect(typeof payload.heightInPx).toBe('number');
  expect(typeof payload.widthInPx).toBe('number');
  expect(typeof payload.scaleFactor).toBe('number');

  // Invariant: native × scale ≈ rendered. Allow 1px tolerance for sub-pixel
  // rounding between getBoundingClientRect and the lib's internal measurement.
  expect(Math.abs(payload.heightInPx * payload.scaleFactor - renderedHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(payload.widthInPx * payload.scaleFactor - renderedWidth)).toBeLessThanOrEqual(1);

  // New / renamed fields
  expect(keys).toContain('allCabins');
  expect(Array.isArray(payload.allCabins)).toBe(true);
  expect(keys).toContain('availabilityData');

  // React parity: `error` key absent when no error
  expect(keys).not.toContain('error');

  // Legacy Angular-only fields removed
  expect(keys).not.toContain('availableSeats');
  expect(keys).not.toContain('allSeats');
  expect(keys).not.toContain('availableCabins');

  // ─── Overlay ───────────────────────────────────────────────────────
  await page.evaluate(
    ({ payload, keys, renderedHeight, renderedWidth }) => {
      const wrap = document.createElement('div');
      wrap.id = 'parity-overlay';
      wrap.style.cssText = `
        position: fixed;
        top: 12px;
        right: 12px;
        width: 820px;
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

      const round = (n: number) => Math.round(n * 100) / 100;
      const nativeH = Number(payload.heightInPx);
      const nativeW = Number(payload.widthInPx);
      const scale = Number(payload.scaleFactor);
      const computedRenderedH = round(nativeH * scale);
      const computedRenderedW = round(nativeW * scale);
      const renderedHeightR = round(renderedHeight);
      const renderedWidthR = round(renderedWidth);

      const checks: Array<{ label: string; pass: boolean; got: string; want: string }> = [
        {
          label: 'heightInPx × scaleFactor ≈ rendered DOM height',
          pass: Math.abs(computedRenderedH - renderedHeightR) <= 1,
          got: `${nativeH} × ${scale} = ${computedRenderedH} (DOM ${renderedHeightR})`,
          want: `match DOM height ±1px`,
        },
        {
          label: 'widthInPx × scaleFactor ≈ rendered DOM width',
          pass: Math.abs(computedRenderedW - renderedWidthR) <= 1,
          got: `${nativeW} × ${scale} = ${computedRenderedW} (DOM ${renderedWidthR})`,
          want: `match DOM width ±1px`,
        },
        {
          label: '`allCabins` present (renamed from `availableCabins`)',
          pass: keys.includes('allCabins'),
          got: keys.includes('allCabins') ? 'present' : 'missing',
          want: 'present',
        },
        {
          label: '`availabilityData` key present (React parity)',
          pass: keys.includes('availabilityData'),
          got: keys.includes('availabilityData') ? 'present' : 'missing',
          want: 'present',
        },
        {
          label: '`error` key omitted when no error',
          pass: !keys.includes('error'),
          got: keys.includes('error') ? `present (${JSON.stringify((payload as Record<string, unknown>).error)})` : 'absent',
          want: 'absent',
        },
        {
          label: 'legacy `availableSeats` removed',
          pass: !keys.includes('availableSeats'),
          got: keys.includes('availableSeats') ? 'present' : 'absent',
          want: 'absent',
        },
        {
          label: 'legacy `allSeats` removed',
          pass: !keys.includes('allSeats'),
          got: keys.includes('allSeats') ? 'present' : 'absent',
          want: 'absent',
        },
        {
          label: 'legacy `availableCabins` removed (renamed)',
          pass: !keys.includes('availableCabins'),
          got: keys.includes('availableCabins') ? 'present' : 'absent',
          want: 'absent',
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
            seatMapInited payload — React parity
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
          actual <code>seatMapInited</code> payload
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
        ">${JSON.stringify(payload, null, 2)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</pre>
      `;

      document.body.appendChild(wrap);
    },
    { payload, keys, renderedHeight, renderedWidth },
  );

  await page.waitForTimeout(150);

  await page.screenshot({
    path: path.join(OUT_DIR, 'seatMapInitedParity-overlay.png'),
    fullPage: false,
  });

  await page.locator('#parity-overlay').screenshot({
    path: path.join(OUT_DIR, 'seatMapInitedParity-panel.png'),
  });
});
