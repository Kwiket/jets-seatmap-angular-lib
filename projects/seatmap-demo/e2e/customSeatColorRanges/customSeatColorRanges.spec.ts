import { test, expect, Page } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';
import * as path from 'path';

/**
 * `colorTheme.customSeatColorRanges` overrides the available-seat fill with
 * a colour picked by the seat's `score` (1–10, both ends inclusive). The
 * matching itself is unit-tested in jets-seat-map-preparer.service.spec; this
 * suite is the end-to-end visual regression.
 *
 * Test surface is the demo's default flight (QT888, LHR → DXB) — its sandbox
 * API response carries `score` on every seat so the range matcher has
 * something to bind to. The `applied` test captures a full-page screenshot
 * so the INIT SEAT MAP textarea (showing the exact ranges JSON) sits next
 * to the rendered seatmap — useful as a manual config↔render check.
 */

const RANGES = [
  { color: '#c7683d', range: [1, 2.99] as [number, number] },
  { color: '#e6be3f', range: [3, 4.99] as [number, number] },
  { color: '#4071b9', range: [5, 6.5] as [number, number] },
  { color: '#8fb947', range: [6.51, 10] as [number, number] },
];

const WILDCARD_AVAILABILITY = [{ label: '*', price: 29, currency: 'USD' }];

function countCustomFills(page: Page, colors: string[]) {
  return page.evaluate((cs: string[]) => {
    const seats = Array.from(document.querySelectorAll('.jets-seat__svg svg')) as SVGElement[];
    const hits: Record<string, number> = {};
    for (const c of cs) hits[c.toLowerCase()] = 0;
    for (const svg of seats) {
      const html = svg.outerHTML.toLowerCase();
      for (const c of cs) {
        if (html.includes(c.toLowerCase())) hits[c.toLowerCase()]++;
      }
    }
    return hits;
  }, colors);
}

test.describe('customSeatColorRanges', () => {
  test('applied — score buckets paint matching colours (QT888)', async ({ page }) => {
    // Wider viewport so the full-page shot below is legible (default project
    // viewport from devices['Desktop Chrome'] is 1280px, which squeezes the
    // control column to ~300px and makes the JSON unreadable).
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto('/');
    // Default flight is QT888 (LHR → DXB); no tab switch needed.
    await applyConfigAndReady(
      page,
      { colorTheme: { customSeatColorRanges: RANGES } },
      { availability: WILDCARD_AVAILABILITY }
    );

    const hits = await countCustomFills(
      page,
      RANGES.map(r => r.color)
    );
    const total = Object.values(hits).reduce((a, b) => a + b, 0);
    expect(
      total,
      `expected ≥1 seat to render one of ${RANGES.map(r => r.color).join(', ')}, got ${JSON.stringify(hits)}`
    ).toBeGreaterThan(0);

    // Sanity-check the INIT SEAT MAP textarea actually carries the ranges JSON
    // — the full-page screenshot below is only useful if the textarea on the
    // right matches the colours on the left.
    const initJson = await page
      .getByRole('button', { name: 'INIT SEAT MAP', exact: true })
      .locator('xpath=ancestor::*[contains(@class,"demo-control-row")][1]')
      .locator('textarea.demo-control-textarea')
      .inputValue();
    expect(initJson).toContain('customSeatColorRanges');
    for (const r of RANGES) expect(initJson).toContain(r.color);

    // Element-level shot (legacy regression baseline).
    await screenshotSeatMap(page, __dirname, 'customSeatColorRanges-applied');

    // Expand the control textareas so their full content is visible in the
    // full-page screenshot below — by default they're capped at 140px and the
    // ranges JSON would scroll out of view.
    await page.evaluate(() => {
      document.querySelectorAll<HTMLTextAreaElement>('textarea.demo-control-textarea').forEach(ta => {
        ta.style.maxHeight = 'none';
        ta.style.height = `${ta.scrollHeight + 8}px`;
      });
    });
    await page.waitForTimeout(100);

    // Full-page shot — captures the INIT SEAT MAP textarea (with the exact
    // RANGES JSON) alongside the rendered seatmap so a reviewer can eyeball
    // that the on-screen colours match the config.
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'customSeatColorRanges-applied-fullpage.png'),
      fullPage: true,
    });
  });

  test('ranges always apply when present (no gate)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(
      page,
      { colorTheme: { customSeatColorRanges: [{ range: [1, 10], color: '#abcdef' }] } },
      { availability: [] }
    );
    const hits = await page.evaluate(() => {
      const seats = Array.from(document.querySelectorAll('.jets-seat--available')) as HTMLElement[];
      let n = 0;
      for (const seat of seats) {
        for (const p of Array.from(seat.querySelectorAll('svg path'))) {
          if ((p.getAttribute('fill') || '').toLowerCase() === '#abcdef') {
            n++;
            break;
          }
        }
      }
      return n;
    });
    expect(hits, 'sentinel range colour must appear on available seats').toBeGreaterThan(0);
  });
});
