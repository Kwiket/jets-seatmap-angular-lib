import { expect, test } from '@playwright/test';
import * as path from 'path';
import { setConfig, setFlight } from '../helpers/demo';

/**
 * Visual proof for the bugfix "handle all types of errors in the library and
 * return it in the `onSeatMapInited`": when the seatmap API fails, the lib
 * now still emits `seatMapInited` with an `error` field shaped like React's
 * (`postData: {status} - {message}`) and `undefined` layout fields. Previously
 * `seatMapInited` was suppressed on failure and only `loadError` fired.
 *
 * The API call is intercepted via `page.route` so the test is deterministic
 * and does not depend on a live backend.
 */

const OUT_DIR = path.join(__dirname, 'screenshots');

test.use({ viewport: { width: 1700, height: 1100 } });

test('seatMapInited payload — error parity proof', async ({ page }) => {
  // Build a JWT whose `exp` is far in the future so the lib's auth cache
  // accepts it. Header/signature don't matter — only the payload's `exp`.
  const fakeJwt = (() => {
    const enc = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ exp: Math.floor(Date.now() / 1000) + 86_400 })}.sig`;
  })();

  // Intercept BOTH the auth handshake and the seatmap POST. Auth succeeds with
  // the fake JWT; seatmap POST returns the same 400 the screenshot from the
  // bug report shows (`arrival must be shorter than or equal to 3 characters`).
  await page.route('**/auth*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: fakeJwt }),
    });
  });
  await page.route('**/flight/features/plane/seatmap*', route => {
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 400,
        message: 'arrival must be shorter than or equal to 3 characters',
        error: 'Bad Request',
      }),
    });
  });

  await page.goto('/');

  // Drop any cached token from a previous run so the auth route gets hit.
  await page.evaluate(() => localStorage.clear());

  await setConfig(page, { width: 380 });
  // Push a flight with a 4-char arrival code to mirror the screenshot from
  // the bug report (UA953, ORDD→MUCC). The mock returns 400 regardless of
  // request body — the override is just so the textarea visibly shows the
  // bad input that triggered the error in production.
  await setFlight(page, {
    id: 'ua953',
    airlineCode: 'UA',
    flightNo: '953',
    departureDate: '2026-09-21',
    departure: 'ORDD',
    arrival: 'MUCC',
    cabinClass: 'A',
    planeCode: '',
  });

  // Wait until the test seam captures the seatMapInited payload — the demo
  // writes it inside onSeatMapInited, which now also fires on error.
  await page.waitForFunction(
    () => (window as Window & { __lastSeatMapInited?: unknown }).__lastSeatMapInited != null,
    null,
    { timeout: 25_000 }
  );

  const captured = await page.evaluate(() => {
    const w = window as Window & { __lastSeatMapInited?: Record<string, unknown> };
    const raw = w.__lastSeatMapInited!;
    return {
      // The keys that are actually *present* on the live object — JSON.stringify
      // drops `undefined`-valued keys, so we have to snapshot this separately.
      keys: Object.keys(raw),
      payload: {
        heightInPx: raw['heightInPx'],
        widthInPx: raw['widthInPx'],
        scaleFactor: raw['scaleFactor'],
        decksCount: raw['decksCount'],
        currentDeckIndex: raw['currentDeckIndex'],
        error: raw['error'],
      },
    };
  });

  // ─── Assertions ────────────────────────────────────────────────────
  expect(captured.payload.error).toBe('postData: 400 - arrival must be shorter than or equal to 3 characters');
  expect(captured.payload.heightInPx).toBeUndefined();
  expect(captured.payload.widthInPx).toBeUndefined();
  expect(captured.payload.scaleFactor).toBeUndefined();
  expect(captured.payload.decksCount).toBeUndefined();
  expect(captured.payload.currentDeckIndex).toBeUndefined();

  // Keys must be present with `undefined` values (mirrors React's payload
  // shape — console.log shows them as `heightInPx: undefined` not omitted).
  for (const k of ['heightInPx', 'widthInPx', 'scaleFactor', 'decksCount', 'currentDeckIndex', 'error']) {
    expect(captured.keys).toContain(k);
  }

  // ─── Overlay ───────────────────────────────────────────────────────
  await page.evaluate(({ payload, keys }) => {
    const wrap = document.createElement('div');
    wrap.id = 'parity-overlay';
    wrap.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      width: 860px;
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

    const checks: Array<{ label: string; pass: boolean; got: string; want: string }> = [
      {
        label: '`seatMapInited` fired on API failure (previously suppressed)',
        pass: payload != null,
        got: 'fired',
        want: 'fired',
      },
      {
        label: '`error` field present with React format `postData: {status} - {message}`',
        pass: typeof payload.error === 'string' && /^postData: \d+ - .+/.test(payload.error as string),
        got: String(payload.error),
        want: 'postData: 400 - arrival must be shorter than or equal to 3 characters',
      },
      {
        label: '`heightInPx` is `undefined` on error',
        pass: payload.heightInPx === undefined,
        got: String(payload.heightInPx),
        want: 'undefined',
      },
      {
        label: '`widthInPx` is `undefined` on error',
        pass: payload.widthInPx === undefined,
        got: String(payload.widthInPx),
        want: 'undefined',
      },
      {
        label: '`scaleFactor` is `undefined` on error',
        pass: payload.scaleFactor === undefined,
        got: String(payload.scaleFactor),
        want: 'undefined',
      },
      {
        label: '`decksCount` is `undefined` on error',
        pass: payload.decksCount === undefined,
        got: String(payload.decksCount),
        want: 'undefined',
      },
      {
        label: '`currentDeckIndex` is `undefined` on error',
        pass: payload.currentDeckIndex === undefined,
        got: String(payload.currentDeckIndex),
        want: 'undefined',
      },
      {
        label: 'all expected keys present on payload (mirrors React console.log)',
        pass: ['heightInPx', 'widthInPx', 'scaleFactor', 'decksCount', 'currentDeckIndex', 'error'].every(k =>
          keys.includes(k)
        ),
        got: keys.join(', '),
        want: 'heightInPx, widthInPx, scaleFactor, decksCount, currentDeckIndex, error',
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
          seatMapInited payload — error parity (React)
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
        actual <code>seatMapInited</code> payload (error path)
      </div>
      <pre style="
        margin: 0;
        padding: 12px;
        background: #060a0f;
        border: 1px solid #21262d;
        border-radius: 6px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 280px;
        overflow: auto;
        color: #d7dee8;
        font-size: 11px;
      ">${JSON.stringify(
        Object.fromEntries(keys.map(k => [k, (payload as Record<string, unknown>)[k]])),
        (_k, v) => (v === undefined ? '<undefined>' : v),
        2
      )
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"&lt;undefined&gt;"/g, '<span style="color:#9aa6b3;font-style:italic;">undefined</span>')}</pre>
    `;

    document.body.appendChild(wrap);
  }, captured);

  await page.waitForTimeout(150);

  await page.screenshot({
    path: path.join(OUT_DIR, 'seatMapInitedErrorParity-overlay.png'),
    fullPage: false,
  });

  await page.locator('#parity-overlay').screenshot({
    path: path.join(OUT_DIR, 'seatMapInitedErrorParity-panel.png'),
  });
});
