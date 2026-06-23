/**
 * Behavioural e2e for horizontal-layout React parity:
 *  - nose direction is controlled by `rightToLeft` (false → nose left,
 *    true → nose right), mirroring the React lib;
 *  - the built-in tooltip stays fully within the viewport in horizontal mode
 *    (regression guard for the P1b off-screen bug).
 */
import { test, expect } from '@playwright/test';
import { applyConfigAndReady, clickFirstAvailableSeat } from '../helpers/demo';

test.describe('horizontal layout — React parity', () => {
  test('nose points LEFT in horizontal LTR (rightToLeft:false)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { horizontal: true, rightToLeft: false, visibleFuselage: true });

    const nose = await page.locator('.jets-nose').first().boundingBox();
    const tail = await page.locator('.jets-tail').first().boundingBox();
    expect(nose, 'nose should render').not.toBeNull();
    expect(tail, 'tail should render').not.toBeNull();
    // Cabin is rotated 90deg; with the LTR flip the nose sits left of the tail.
    expect(nose!.x).toBeLessThan(tail!.x);
  });

  test('nose points RIGHT in horizontal RTL (rightToLeft:true)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { horizontal: true, rightToLeft: true, visibleFuselage: true });

    const nose = await page.locator('.jets-nose').first().boundingBox();
    const tail = await page.locator('.jets-tail').first().boundingBox();
    expect(nose, 'nose should render').not.toBeNull();
    expect(tail, 'tail should render').not.toBeNull();
    expect(nose!.x).toBeGreaterThan(tail!.x);
  });

  test('built-in tooltip stays within the viewport in horizontal mode (P1b)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, { horizontal: true, rightToLeft: false });
    await clickFirstAvailableSeat(page);

    const tip = page.locator('.jets-tooltip').first();
    await expect(tip).toBeVisible();

    const box = await tip.boundingBox();
    const vp = page.viewportSize();
    expect(box, 'tooltip should have a box').not.toBeNull();
    expect(vp, 'viewport size').not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp!.height);
  });
});
