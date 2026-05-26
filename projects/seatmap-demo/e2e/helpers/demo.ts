/**
 * Shared helpers for the Angular seatmap-demo Playwright suite.
 *
 * The demo app at http://localhost:4200 exposes a controls panel with one
 * <button> + <textarea> per lifecycle step (INIT SEAT MAP, SET FLIGHT,
 * SET AVAILABILITY, SET PASSENGERS, SET DECK, SEAT JUMP TO). Each test:
 *   1. navigates to /
 *   2. mutates the relevant textarea(s) via the helpers below
 *   3. clicks the corresponding lifecycle button
 *   4. waits for the seat map to (re-)initialize
 *   5. screenshots the .jets-seat-map element
 *
 * Helpers are platform-agnostic: no iframe handling, no Storybook
 * assumptions. They mirror the contract used by the React Playwright suite
 * (window.__setConfig, window.__clickBtn) but expressed through Playwright
 * locators.
 */

import { expect, Page } from '@playwright/test';
import * as path from 'path';

const CONTROL_LABELS = {
  config: 'INIT SEAT MAP',
  flight: 'SET FLIGHT',
  availability: 'SET AVAILABILITY',
  passengers: 'SET PASSENGERS',
  deck: 'SET DECK',
  seatJumpTo: 'SEAT JUMP TO',
} as const;

type ControlKey = keyof typeof CONTROL_LABELS;

/**
 * Type guard: `IConfig` is part of the public API of the seatmap-lib.
 * Here we keep helpers untyped (Record<string, unknown>) to avoid importing
 * from the lib in e2e (which would couple the suite to library internals).
 */
export type ConfigOverrides = Record<string, unknown>;

function textareaFor(page: Page, key: ControlKey) {
  // Each control row contains both the button and the textarea. Anchor on
  // the button label (exact, role-based) then walk up to the parent row.
  const row = page
    .getByRole('button', { name: CONTROL_LABELS[key], exact: true })
    .locator('xpath=ancestor::*[contains(@class,"demo-control-row")][1]');
  return row.locator('textarea.demo-control-textarea');
}

/**
 * Read the current JSON value of a control's textarea, parse and return it.
 * Falls back to `null` if the textarea is empty or contains invalid JSON.
 */
async function readJson(page: Page, key: ControlKey): Promise<unknown | null> {
  const raw = await textareaFor(page, key).inputValue();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write a value into a control's textarea. We can't just use `fill()` because
 * Angular `ngModel` listens for the `input` event from the native HTMLTextArea
 * setter. Playwright's `fill` already dispatches `input` events, but on some
 * Angular zoneless / signals-only setups the native setter trick used by
 * React-Playwright is more reliable. Here we use both: fill + explicit input
 * event dispatch.
 */
async function writeRaw(page: Page, key: ControlKey, raw: string): Promise<void> {
  const ta = textareaFor(page, key);
  await ta.fill(raw);
  await ta.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
}

async function clickControl(page: Page, key: ControlKey): Promise<void> {
  await page
    .getByRole('button', { name: CONTROL_LABELS[key], exact: true })
    .click();
}

/**
 * Merge config overrides with whatever is currently in the INIT textarea,
 * write the merged JSON back, then click INIT SEAT MAP. The demo's
 * `applyControl('config')` will parse and apply the overrides.
 */
export async function setConfig(page: Page, overrides: ConfigOverrides): Promise<void> {
  const base = ((await readJson(page, 'config')) as ConfigOverrides | null) ?? {};
  const merged = { ...base, ...overrides };
  // Strip undefined keys so JSON.stringify omits them.
  for (const k of Object.keys(merged)) {
    if (merged[k] === undefined) delete merged[k];
  }
  await writeRaw(page, 'config', JSON.stringify(merged, null, 2));
  await clickControl(page, 'config');
}

/**
 * Optionally override the flight JSON (rarely needed). Without `flight`,
 * just clicks SET FLIGHT to (re)load the current selection.
 */
export async function setFlight(page: Page, flight?: ConfigOverrides): Promise<void> {
  if (flight !== undefined) {
    const base = ((await readJson(page, 'flight')) as ConfigOverrides | null) ?? {};
    const merged = { ...base, ...flight };
    await writeRaw(page, 'flight', JSON.stringify(merged, null, 2));
  }
  await clickControl(page, 'flight');
}

export async function setAvailability(page: Page, items?: unknown[]): Promise<void> {
  if (items !== undefined) {
    await writeRaw(page, 'availability', JSON.stringify(items, null, 2));
  }
  await clickControl(page, 'availability');
}

export async function setPassengers(page: Page, list?: unknown[]): Promise<void> {
  if (list !== undefined) {
    await writeRaw(page, 'passengers', JSON.stringify(list, null, 2));
  }
  await clickControl(page, 'passengers');
}

export async function clickButton(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
}

/**
 * Wait until the seatmap reports its `inited` event in the demo's event log,
 * or — as a fallback — at least one seat element appears in the DOM. If the
 * demo reports a `loadError` instead (e.g. API misconfigured), fail fast with
 * a clear message rather than burning the full timeout.
 *
 * The base timeout is generous (25s) to absorb cold-start latency on CI
 * (Angular dev-server warm-up, vite prebundle, first auth round-trip).
 */
export async function waitForSeatMapReady(page: Page, timeoutMs = 25_000): Promise<void> {
  const inited = page
    .locator('.demo-log-entry.log-inited')
    .first()
    .waitFor({ state: 'visible', timeout: timeoutMs });
  const firstSeat = page
    .locator('.jets-seat[data-seat-number]')
    .first()
    .waitFor({ state: 'visible', timeout: timeoutMs });
  const loadError = page
    .locator('.demo-log-entry.log-error, .jets-seat-map__error')
    .first()
    .waitFor({ state: 'visible', timeout: timeoutMs })
    .then(async () => {
      const message = await page
        .locator('.demo-log-entry.log-error .log-msg, .jets-seat-map__error')
        .first()
        .innerText()
        .catch(() => '(no error text)');
      throw new Error(`Seatmap failed to initialize — demo reported: ${message}`);
    });

  await Promise.race([inited, firstSeat, loadError]);
  // Give Angular CD one more tick so animations/layout settle before the screenshot.
  await page.waitForTimeout(150);
}

/**
 * Take a screenshot of the seatmap area and save it under <specDir>/screenshots/<fileName>.png.
 * `specDir` is typically `path.dirname(__filename)` from the calling .spec.ts via `import.meta`.
 */
export async function screenshotSeatMap(
  page: Page,
  specDir: string,
  fileName: string,
): Promise<string> {
  const safe = fileName.replace(/[^\w.\-]+/g, '_');
  const outPath = path.join(specDir, 'screenshots', `${safe}.png`);
  const map = page.locator('.demo-seatmap-wrapper').first();
  await expect(map).toBeVisible();
  await map.screenshot({ path: outPath });
  return outPath;
}

/**
 * Click a seat by its visible number (e.g. "20A"). Used by tooltip-related tests.
 * Times out after 5s to fail fast instead of locking up the test.
 */
export async function selectSeat(page: Page, seatNumber: string): Promise<void> {
  await page
    .locator(`[data-seat-number="${seatNumber}"]`)
    .first()
    .click({ timeout: 5_000 });
}

/**
 * Click the first interactive (available/selected/preferred/extra) seat. Use
 * when the spec just needs *some* seat to open a tooltip — the exact number
 * doesn't matter.
 *
 * The wait is generous (25s) because in CI the seatmap re-renders three
 * times during applyConfigAndReady (INIT → SET FLIGHT → SET AVAILABILITY)
 * and the `.jets-seat--available` class only lands on seats after the third
 * pass settles, which can lag well past `inited`.
 */
export async function clickFirstAvailableSeat(page: Page): Promise<void> {
  // Let the dev-server quiet down so the lib's async re-renders have settled.
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {
    /* networkidle can be flaky under vite HMR; fall through to the seat wait */
  });
  const seat = page
    .locator('.jets-seat--available[data-seat-number]')
    .first();
  await seat.waitFor({ state: 'visible', timeout: 25_000 });
  await seat.scrollIntoViewIfNeeded();
  await seat.click({ timeout: 5_000 });
}

/**
 * Convenience: run the standard INIT → FLIGHT → AVAILABILITY lifecycle with
 * a single config override. Most feature tests just need this.
 */
export async function applyConfigAndReady(
  page: Page,
  overrides: ConfigOverrides,
  opts: { availability?: unknown[] } = {},
): Promise<void> {
  await setConfig(page, overrides);
  await setFlight(page);
  await setAvailability(page, opts.availability);
  await waitForSeatMapReady(page);
}
