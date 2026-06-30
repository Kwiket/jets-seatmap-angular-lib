/**
 * Dump getBoundingClientRect for every nested element inside `.jets-seat-map`
 * in both the flags-off and flags-on configurations, then diff the heights.
 * Strictly diagnostic — output goes to stdout, not artefacts.
 */
import { expect, test } from '@playwright/test';
import { applyConfigAndReady, waitForSeatMapReady } from '../helpers/demo';

test('dump DOM offset heights for DL898 with vs without wcag.enabled', async ({ page }) => {
  test.setTimeout(60_000);

  const measure = async (label: string) => {
    const out = await page.evaluate(label => {
      const root = document.querySelector('.jets-seat-map');
      if (!root) return { label, error: 'no .jets-seat-map' };
      const all = root.querySelectorAll('*');
      const rows: Array<{ tag: string; cls: string; h: number; w: number; y: number }> = [];
      for (const el of [root, ...all]) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.height < 10) continue;
        rows.push({
          tag: (el as HTMLElement).tagName.toLowerCase(),
          cls: ((el as HTMLElement).className || '').toString().slice(0, 60),
          h: Math.round(r.height),
          w: Math.round(r.width),
          y: Math.round(r.top + window.scrollY),
        });
      }
      const region = document.querySelector('.jets-seat-map__region') as HTMLElement | null;
      const regionRect = region?.getBoundingClientRect();
      return {
        label,
        rootHeight: Math.round((root as HTMLElement).getBoundingClientRect().height),
        regionHeight: regionRect ? Math.round(regionRect.height) : null,
        topRows: rows.slice(0, 25),
      };
    }, label);
    console.log(`\n=== ${label} ===`);
    console.log('rootHeight:', out.rootHeight, ' regionHeight:', out.regionHeight);
    for (const r of out.topRows ?? []) {
      console.log(
        `  ${r.h.toString().padStart(5)} × ${r.w.toString().padStart(4)} @ y=${r.y.toString().padStart(5)}  ${r.tag.padEnd(20)} ${r.cls}`
      );
    }
  };

  await page.goto('/');
  await waitForSeatMapReady(page);

  // Switch to DL898 and apply DEFAULT_AVAILABILITY so both runs have same content.
  await page.locator('nav button', { hasText: 'DL898' }).first().click();
  await applyConfigAndReady(page, {});
  await measure('wcag-off (DL898, DEFAULT_AVAILABILITY)');

  // Now flip every WCAG flag on.
  await applyConfigAndReady(page, { wcag: { enabled: true } });
  await measure('wcag-on  (DL898, DEFAULT_AVAILABILITY)');

  expect(true).toBe(true);
});
