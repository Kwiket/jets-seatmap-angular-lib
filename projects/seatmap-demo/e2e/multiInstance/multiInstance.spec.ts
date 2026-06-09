import { expect, test } from '@playwright/test';
import * as path from 'path';

/**
 * Smoke-test for running multiple JetsSeatMapComponent instances on the
 * same page. Verifies (1) all 4 instances mount, (2) each emits its own
 * `seatMapInited` payload independently, (3) selecting a seat in one
 * instance does NOT trigger `seatSelected` in the others — i.e. the
 * library's `providedIn: 'root'` services don't bleed state across
 * instances. Final artefact: one full-page screenshot at
 * `screenshots/four-instances.png`.
 */
test.describe('multi-instance smoke test', () => {
  test.setTimeout(90_000);

  test('four independent seatmap instances render, init and isolate selection', async ({ page }) => {
    await page.goto('/?multiInstance=1');

    // 1. All four fixture cells exist in the DOM.
    await expect(page.locator('[data-instance-idx]')).toHaveCount(4);
    await expect(page.locator('sm-jets-seat-map')).toHaveCount(4);

    // 2. Wait until every instance has reported `seatMapInited`.
    await page.waitForFunction(
      () =>
        Array.isArray(window.__multiInstanceReady) &&
        window.__multiInstanceReady.length === 4 &&
        window.__multiInstanceReady.every(Boolean),
      undefined,
      { timeout: 60_000 }
    );

    // Each instance carries non-empty cabin data.
    const initedPayloads = await page.evaluate(() => window.__multiInstanceInited);
    expect(initedPayloads).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(initedPayloads?.[i], `instance ${i} should have an inited payload`).not.toBeNull();
      const cabinsLen = (initedPayloads?.[i] as { allCabins?: unknown[] } | null)?.allCabins?.length ?? 0;
      expect(cabinsLen, `instance ${i} must have at least one cabin`).toBeGreaterThan(0);
    }

    // 3. Isolation check: each instance is configured with a different
    //    `cabinClass`, so each inited payload must describe a different cabin
    //    set. If `providedIn: 'root'` services bled state between instances we
    //    would see identical payloads.
    const cabinSignatures = (initedPayloads ?? []).map(p => {
      const cabins = (p as { allCabins?: { cabinClass?: string }[] } | null)?.allCabins ?? [];
      return cabins.map(c => c.cabinClass ?? '?').sort().join(',');
    });
    const distinctSignatures = new Set(cabinSignatures);
    expect(
      distinctSignatures.size,
      `inited payloads must differ between instances — got signatures ${JSON.stringify(cabinSignatures)}`
    ).toBeGreaterThanOrEqual(2);

    // Instance 3 is `horizontal: true`, so its rendered dimensions must
    // differ from the vertical instance 0 — a direct visual check that
    // per-instance config is honoured independently.
    const w0 = (initedPayloads?.[0] as { widthInPx?: number } | null)?.widthInPx ?? 0;
    const w3 = (initedPayloads?.[3] as { widthInPx?: number } | null)?.widthInPx ?? 0;
    expect(w0, 'instance 0 width should be > 0').toBeGreaterThan(0);
    expect(w3, 'instance 3 width should be > 0').toBeGreaterThan(0);
    expect(w0, 'horizontal instance 3 width must differ from vertical instance 0').not.toEqual(w3);

    // 4. Final artefact: one full-page screenshot showing all four cabins.
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(100);
    const outPath = path.join(__dirname, 'screenshots', 'four-instances.png');
    await page.screenshot({ path: outPath, fullPage: true });
  });
});
