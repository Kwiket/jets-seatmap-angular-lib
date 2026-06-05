/**
 * WCAG 2.2 AA — visible feature tour with video recording.
 *
 * This is NOT a test (no `expect`). It's a guided walkthrough that records
 * each WCAG feature visible on screen for review. Output: a single 720p
 * webm video per scenario, written by Playwright into `test-results/`.
 *
 * Run with:
 *   npx playwright test --config=projects/seatmap-demo/e2e/playwright.config.ts \
 *     projects/seatmap-demo/e2e/a11y-tour
 */
import { test, type Page } from '@playwright/test';
import { applyConfigAndReady } from '../helpers/demo';

// 720p video, slowed down so each keystroke is visible to a reviewer.
test.use({
  viewport: { width: 1280, height: 720 },
  video: {
    mode: 'on',
    size: { width: 1280, height: 720 },
  },
  launchOptions: { slowMo: 250 },
});

const FIRST_INTERACTIVE_SEAT =
  'button.jets-seat--available[role="gridcell"], ' +
  'button.jets-seat--selected[role="gridcell"], ' +
  'button.jets-seat--preferred[role="gridcell"], ' +
  'button.jets-seat--extra[role="gridcell"]';

async function pause(page: Page, ms = 600): Promise<void> {
  await page.waitForTimeout(ms);
}

async function focusFirstSeat(page: Page): Promise<void> {
  await page.locator(FIRST_INTERACTIVE_SEAT).first().focus();
  await pause(page);
}

/**
 * Press Enter on the focused seat to open the tooltip. If Angular OnPush
 * swallows the synthetic keypress (a known Playwright quirk against
 * Angular OnPush components — same workaround the commit 16 e2e suite
 * uses), fall back to dispatching a click on the focused element.
 */
async function openTooltipFromFocusedSeat(page: Page, timeoutMs = 3000): Promise<void> {
  await page.keyboard.press('Enter');
  try {
    await page.waitForSelector('.jets-tooltip[role="dialog"]', { state: 'visible', timeout: timeoutMs });
    return;
  } catch {
    // Fallback: click the focused element.
    await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      el?.click();
    });
    await page.waitForSelector('.jets-tooltip[role="dialog"]', { state: 'visible', timeout: timeoutMs });
  }
}

test.describe('WCAG 2.2 AA feature tour', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('1. Keyboard navigation — Tab into grid, arrow keys advance, Enter opens dialog, Escape closes', async ({
    page,
  }) => {
    await applyConfigAndReady(page, {});

    // Land focus on the body so the Tab cycle starts predictably.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.focus();
    });
    await pause(page);

    // Tab a few times — the skip-link and deck-selector come into view first.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(120);
    }

    // Focus the first interactive seat deterministically (the demo's
    // controls panel adds chrome between body and the grid).
    await focusFirstSeat(page);

    // Arrow nav — show focus moving around.
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft']) {
      await page.keyboard.press(key);
      await pause(page, 350);
    }

    // Home / End — geometric jumps within the current row.
    await page.keyboard.press('Home');
    await pause(page, 400);
    await page.keyboard.press('End');
    await pause(page, 400);

    // Re-focus the first interactive seat so Enter has a real target
    // (End / Ctrl+End may land on a non-interactive aisle / empty cell).
    await focusFirstSeat(page);

    // Enter on the focused seat opens the tooltip dialog (auto-focuses the
    // primary action button).
    await openTooltipFromFocusedSeat(page);
    await pause(page, 1200);

    // Escape closes and focus returns to the trigger seat.
    await page.keyboard.press('Escape');
    await pause(page, 800);
  });

  test('2. Focus-triggered tooltip (1.4.13) — tooltipOnHover opens on focus too', async ({ page }) => {
    await applyConfigAndReady(page, { tooltipOnHover: true });

    await focusFirstSeat(page);
    await page.waitForSelector('.jets-tooltip[role="dialog"]', { state: 'visible', timeout: 5000 });
    await pause(page, 1500);

    // Hover into the tooltip — it must stay open (hoverable).
    const tooltip = page.locator('.jets-tooltip').first();
    await tooltip.hover();
    await pause(page, 1200);

    // Move focus to next seat — tooltip moves with focus.
    await page.keyboard.press('ArrowRight');
    await pause(page, 1200);

    // Escape closes from inside.
    await page.keyboard.press('Escape');
    await pause(page, 800);
  });

  test('3. Tooltip dialog focus management — primary action auto-focused on open', async ({ page }) => {
    await applyConfigAndReady(page, {});
    await focusFirstSeat(page);
    await openTooltipFromFocusedSeat(page);
    await pause(page, 1500);

    // Tab inside the dialog cycles through buttons (Select → Cancel).
    await page.keyboard.press('Tab');
    await pause(page, 600);
    await page.keyboard.press('Tab');
    await pause(page, 600);

    await page.keyboard.press('Escape');
    await pause(page, 600);
  });

  test.skip('4. Alternative list view — semantic table with filters and sort', async ({ page }) => {
    // Force list view so we can show the alternative semantic representation.
    await applyConfigAndReady(page, { alternativeView: 'list' });
    await page.waitForSelector('sm-jets-seat-list table', { state: 'visible' });
    await pause(page, 1200);

    // Scroll the table into view, exercise a filter checkbox, then a sort.
    const table = page.locator('sm-jets-seat-list').first();
    await table.scrollIntoViewIfNeeded();
    await pause(page, 800);

    // Tick "Window" filter.
    const windowFilter = page.locator('sm-jets-seat-list input[type="checkbox"]').first();
    await windowFilter.scrollIntoViewIfNeeded();
    await windowFilter.click();
    await pause(page, 1200);

    // Sort by price ascending.
    const sortSelect = page.locator('sm-jets-seat-list select').first();
    await sortSelect.selectOption({ index: 1 });
    await pause(page, 1200);

    // Click an action button — emits seatSelected through the same handler
    // as the grid, so LiveAnnouncer fires.
    const firstActionButton = page.locator('sm-jets-seat-list tbody button:not([disabled])').first();
    await firstActionButton.scrollIntoViewIfNeeded();
    await pause(page, 600);
  });

  test('5. prefers-reduced-motion — smooth transitions suppressed', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
      recordVideo: { dir: 'test-results/wcag-tour-reduced-motion', size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await page.goto('/');
    await applyConfigAndReady(page, {});
    await focusFirstSeat(page);
    await pause(page, 800);

    // Arrow nav under reduced motion — scrolling/transitions should be instant.
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowRight']) {
      await page.keyboard.press(key);
      await pause(page, 350);
    }

    // Ensure focus is back on a guaranteed interactive seat so Enter has a target.
    await focusFirstSeat(page);
    await openTooltipFromFocusedSeat(page);
    await pause(page, 1200);
    await page.keyboard.press('Escape');
    await pause(page, 600);

    await context.close();
  });

  test('6. forced-colors emulation — high-contrast mode survives', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      forcedColors: 'active',
      colorScheme: 'dark',
      recordVideo: { dir: 'test-results/wcag-tour-forced-colors', size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await page.goto('/');
    await applyConfigAndReady(page, {});
    await pause(page, 800);
    await focusFirstSeat(page);
    await pause(page, 1500);

    // Arrow nav — show that focus-ring + seat boundaries survive
    // system colour normalisation.
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowRight']) {
      await page.keyboard.press(key);
      await pause(page, 500);
    }

    // Ensure focus is back on a guaranteed interactive seat so Enter has a target.
    await focusFirstSeat(page);
    await openTooltipFromFocusedSeat(page);
    await pause(page, 1500);
    await page.keyboard.press('Escape');
    await pause(page, 600);

    await context.close();
  });
});
