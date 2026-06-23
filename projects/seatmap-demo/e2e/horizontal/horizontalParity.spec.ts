/**
 * Behavioural e2e for horizontal-layout React parity:
 *  - nose direction is controlled by `rightToLeft` (false → nose left,
 *    true → nose right), mirroring the React lib;
 *  - the built-in tooltip stays fully within the viewport in horizontal mode
 *    (regression guard for the P1b off-screen bug).
 */
import { test, expect } from '@playwright/test';
import { applyConfigAndReady, clickFirstAvailableSeat, setConfig, waitForSeatMapReady } from '../helpers/demo';

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

  test('demo stacks controls below the rotated seatmap in horizontal mode', async ({ page }) => {
    // In horizontal mode the cabin rotates 90deg and can be far wider than the
    // viewport. The demo's flex-row layout squeezed the controls column to a
    // sliver pushed off to the right (the helper even needs `force:true` to
    // click through). The demo must stack the controls *below* the map and keep
    // them full-width and on-screen.
    await page.goto('/');
    await applyConfigAndReady(page, { horizontal: true, rightToLeft: false });

    const mapBox = await page.locator('.jets-seat-map').first().boundingBox();
    const controlsBox = await page.locator('.demo-controls-panel').first().boundingBox();
    const vp = page.viewportSize();
    expect(mapBox, 'seatmap should render').not.toBeNull();
    expect(controlsBox, 'controls panel should render').not.toBeNull();
    expect(vp, 'viewport size').not.toBeNull();

    // 1) Controls sit BELOW the seatmap (stacked), not beside it.
    expect(controlsBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height - 2);

    // 2) Controls keep a usable width and stay within the viewport — not the
    //    collapsed 42px sliver shoved off-screen by the old row layout.
    expect(controlsBox!.width).toBeGreaterThan(200);
    expect(controlsBox!.x).toBeGreaterThanOrEqual(0);
    expect(controlsBox!.x + controlsBox!.width).toBeLessThanOrEqual(vp!.width + 1);
  });

  test('reserves the rotated footprint when horizontal is toggled on an already-loaded map', async ({ page }) => {
    // Regression: toggling `horizontal` via a config change (not a full flight
    // reload) skipped the swapped-dimension measurement, so the container kept
    // its tall vertical layout height (~3139px) and the rotated strip left a
    // huge empty gap above the controls. The container must reserve the wide,
    // short footprint instead.
    await page.goto('/');
    await waitForSeatMapReady(page); // default vertical map loads first
    await setConfig(page, { horizontal: true, visibleFuselage: true }); // in-place toggle
    await waitForSeatMapReady(page);

    const map = await page.locator('.jets-seat-map').first().boundingBox();
    expect(map, 'seatmap should render').not.toBeNull();
    // A horizontal cabin is a wide, short strip: reserved height must be far
    // smaller than width. (Collapsed bug: height === full tall layout > width.)
    expect(map!.height).toBeLessThan(map!.width);
  });

  test('reserves room for cabin titles, wings and the nose in horizontal mode', async ({ page }) => {
    // The rotated footprint must include the side cabin labels and wings (which
    // stick ~20px past the fuselage box) and the nose/tail caps (which stick
    // past it sideways). With the wrapper clipping overflow, anything outside
    // the reserved container gets cut — the cabin titles were sheared off the
    // bottom and the nose ran off the top-left.
    await page.goto('/');
    await applyConfigAndReady(page, {
      horizontal: true,
      rightToLeft: false,
      visibleFuselage: true,
      visibleWings: true,
      visibleCabinTitles: true,
    });

    const map = await page.locator('.jets-seat-map').first().boundingBox();
    const nose = await page.locator('.jets-nose').first().boundingBox();
    const label = await page.locator('.jets-cabin-label').first().boundingBox();
    expect(map, 'seatmap should render').not.toBeNull();
    expect(nose, 'nose should render').not.toBeNull();
    expect(label, 'cabin label should render').not.toBeNull();

    // Reserved height must exceed the bare fuselage strip so the side overlays
    // fit (the rotated nose height is the fuselage width).
    expect(map!.height).toBeGreaterThan(nose!.height);

    // Nothing clips: nose stays within the container's top-left, the cabin
    // label stays within its bottom. (1px slack for sub-pixel rounding.)
    expect(nose!.y).toBeGreaterThanOrEqual(map!.y - 1);
    expect(nose!.x).toBeGreaterThanOrEqual(map!.x - 1);
    expect(label!.y + label!.height).toBeLessThanOrEqual(map!.y + map!.height + 1);
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
