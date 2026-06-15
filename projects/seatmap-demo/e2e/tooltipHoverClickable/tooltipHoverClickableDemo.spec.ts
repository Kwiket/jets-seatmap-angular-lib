/**
 * Slow, human-paced demonstration of rule #2 (builtInTooltip=true +
 * tooltipOnHover=true). Mouse movements use many steps so the recorded
 * video actually shows the cursor travelling from the seat to the tooltip
 * Cancel button instead of teleporting between targets.
 *
 * This spec exists for the recorded video only — fast assertions live in
 * `tooltipHoverClickable.spec.ts`.
 */
import { expect, test } from '@playwright/test';
import { applyConfigAndReady } from '../helpers/demo';

test.use({
  video: { mode: 'on', size: { width: 1280, height: 800 } },
  viewport: { width: 1280, height: 800 },
});

/**
 * Playwright's synthetic mouse events don't move the OS cursor, so the
 * recorded video shows actions happening "by themselves". This init script
 * injects a CSS-only fake cursor that listens to `mousemove` and tracks
 * Playwright's virtual pointer, so the video shows where the cursor is.
 */
const FAKE_CURSOR_INIT = `
  (() => {
    const ensure = () => {
      if (document.getElementById('__pw_cursor')) return;
      const c = document.createElement('div');
      c.id = '__pw_cursor';
      c.style.cssText =
        'position:fixed;width:18px;height:18px;border-radius:50%;' +
        'background:rgba(255,0,0,0.65);border:2px solid #fff;' +
        'box-shadow:0 0 6px rgba(0,0,0,0.6);pointer-events:none;' +
        'z-index:2147483647;transform:translate(-50%,-50%);' +
        'left:-100px;top:-100px;';
      (document.body || document.documentElement).appendChild(c);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensure);
    } else {
      ensure();
    }
    window.addEventListener('mousemove', e => {
      ensure();
      const c = document.getElementById('__pw_cursor');
      if (!c) return;
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
    }, true);
    window.addEventListener('mousedown', () => {
      const c = document.getElementById('__pw_cursor');
      if (c) c.style.background = 'rgba(255,200,0,0.95)';
    }, true);
    window.addEventListener('mouseup', () => {
      const c = document.getElementById('__pw_cursor');
      if (c) c.style.background = 'rgba(255,0,0,0.65)';
    }, true);
  })();
`;

// Generous default action timeouts so paused steps don't trip the
// actionability checker.
test.setTimeout(60_000);

async function pause(page: import('@playwright/test').Page, ms: number) {
  await page.waitForTimeout(ms);
}

async function slowMoveTo(
  page: import('@playwright/test').Page,
  target: import('@playwright/test').Locator,
  steps = 40
) {
  const box = await target.boundingBox();
  if (!box) throw new Error('target has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps });
}

test('demo: hover → walk to tooltip → click Cancel', async ({ page }) => {
  await page.addInitScript(FAKE_CURSOR_INIT);
  await page.goto('/');
  await applyConfigAndReady(page, {
    builtInTooltip: true,
    tooltipOnHover: true,
  });

  // Park the cursor somewhere neutral first so the next move is visibly
  // a travel, not a jump.
  await page.mouse.move(20, 20);
  await pause(page, 600);

  const interactiveSeatSelector =
    '.jets-seat.jets-seat--available, ' +
    '.jets-seat.jets-seat--selected, ' +
    '.jets-seat.jets-seat--preferred, ' +
    '.jets-seat.jets-seat--extra';
  const seat = page.locator(interactiveSeatSelector).first();
  await seat.waitFor({ state: 'visible', timeout: 25_000 });
  await seat.scrollIntoViewIfNeeded();

  // Walk onto the seat — tooltip should appear. Modest step count so the
  // cursor visibly travels but doesn't dawdle long enough for the
  // hoverable-grace timer to mis-fire while still over the seat.
  await slowMoveTo(page, seat, 25);
  await pause(page, 800);

  const tooltip = page.locator('.jets-tooltip');
  await expect(tooltip).toBeVisible({ timeout: 5_000 });
  await pause(page, 600);

  // Walk from seat → Cancel button inside the tooltip. Steps tuned so the
  // 12 px gap traverse fits inside the HOVER_CLOSE_DELAY_MS window
  // (mirrors a normal human cursor speed of ~500 px/s).
  const cancelBtn = page.locator('.jets-cancel-btn');
  await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
  await slowMoveTo(page, cancelBtn, 15);
  await pause(page, 1000);

  // Tooltip is still alive and the button is still under the cursor.
  await expect(tooltip).toBeVisible();
  await expect(cancelBtn).toBeVisible();

  // Click — proves the click event actually dispatches against the live
  // button, not against an already-removed DOM node.
  await page.mouse.down();
  await page.mouse.up();
  await pause(page, 800);
  await expect(tooltip).toBeHidden({ timeout: 5_000 });
  await pause(page, 600);
});
