import { test } from '@playwright/test';
import { applyConfigAndReady, screenshotSeatMap } from '../helpers/demo';

test.describe('singleDeckMode', () => {
  test('true', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {
      singleDeckMode: true,
      builtInDeckSelector: true,
    });
    await screenshotSeatMap(page, __dirname, 'singleDeckMode-true');
  });

  test('false', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {
      singleDeckMode: false,
      builtInDeckSelector: true,
    });
    // Two screenshots: page top + scrolled to bottom — the all-decks layout
    // is taller than the viewport.
    await screenshotSeatMap(page, __dirname, 'singleDeckMode-false-top');
    await page.evaluate(() => {
      const wrap = document.querySelector('.demo-seatmap-wrapper');
      wrap?.scrollTo({ top: 100_000, behavior: 'instant' as ScrollBehavior });
      window.scrollTo({ top: 100_000, behavior: 'instant' as ScrollBehavior });
    });
    await page.waitForTimeout(300);
    await screenshotSeatMap(page, __dirname, 'singleDeckMode-false-bottom');
  });
});
