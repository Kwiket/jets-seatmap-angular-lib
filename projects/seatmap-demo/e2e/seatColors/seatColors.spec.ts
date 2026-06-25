import { test, expect, type Page } from '@playwright/test';
import { applyConfigAndReady } from '../helpers/demo';

const RANGES = [{ range: [1, 10] as [number, number], color: '#abcdef' }];
const CLASSES = { F: '#111111', B: '#222222', P: '#333333', E: '#444444', A: '#555555' };
const FLAT = '#0a0a0a';

async function bodyColours(page: Page): Promise<Set<string>> {
  return new Set(
    await page.evaluate(() => {
      const grey = new Set(['rgb(169, 169, 169)', 'rgb(235, 235, 235)', 'rgb(255, 255, 255)', 'white', 'none', '#ffffff', '#fff']);
      const out: string[] = [];
      for (const seat of Array.from(document.querySelectorAll('.jets-seat--available')) as HTMLElement[]) {
        for (const p of Array.from(seat.querySelectorAll('svg path'))) {
          const f = (p.getAttribute('fill') || '').toLowerCase().trim();
          if (f && !grey.has(f)) { out.push(f); break; }
        }
      }
      return out;
    })
  );
}

test.describe('seat colour modes (config-driven)', () => {
  test('both off: seatAvailableColor flattens every available seat', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { colorTheme: { seatAvailableColor: FLAT } }, { availability: [] });
    const colours = await bodyColours(page);
    expect(colours.size).toBe(1);
    expect([...colours][0]).toBe(FLAT);
  });

  test('score on: ranges colour the seats', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { colorTheme: { customSeatColorRanges: RANGES } }, { availability: [] });
    expect(await bodyColours(page)).toContain('#abcdef');
  });

  test('class on: class palette overrides the API colour', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { colorTheme: { customSeatColorClasses: CLASSES } }, { availability: [] });
    const colours = await bodyColours(page);
    expect(colours.size).toBeGreaterThan(0);
    expect([...colours].every(c => Object.values(CLASSES).map(v => v.toLowerCase()).includes(c))).toBe(true);
  });

  test('both on: score wins over class', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(
      page,
      { colorTheme: { customSeatColorRanges: RANGES, customSeatColorClasses: CLASSES } },
      { availability: [] }
    );
    const colours = await bodyColours(page);
    expect(colours.has('#abcdef')).toBe(true);
  });

  test('availability colour overrides score', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(
      page,
      { colorTheme: { customSeatColorRanges: RANGES } },
      { availability: [{ label: '*', price: 10, currency: 'USD', color: '#fe00fe' }] }
    );
    expect(await bodyColours(page)).toContain('#fe00fe');
  });
});
