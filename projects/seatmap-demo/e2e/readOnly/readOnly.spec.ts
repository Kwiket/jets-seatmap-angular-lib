import { expect, test } from '@playwright/test';
import { applyConfigAndReady, screenshotElement, selectSeat, setPassengers } from '../helpers/demo';

/**
 * Parity proof for the `passenger.readOnly` flag.
 *
 * React reference (jets-seatmap-react-lib-pub):
 *   - TooltipGlobal.view.js:133 — `disabled={data?.passenger?.readOnly}`
 *   - SeatMap.js:312          — click on readOnly occupant is a no-op
 *   - service.js:198          — `getNextPassenger` skips readOnly entries
 *
 * Here we drive the public demo lifecycle (INIT → FLIGHT → AVAILABILITY →
 * PASSENGERS) with a single passenger marked `readOnly: true` and a pre-
 * assigned `seat.seatLabel`. The `setPassengersHandler` in the lib then paints
 * that seat as `selected` with the passenger badge attached. Clicking the seat
 * opens the built-in tooltip, and the Unselect button must come up DOM-disabled
 * — no `seatUnselected` event, no state change.
 */

interface Passenger {
  id: string;
  passengerType: 'ADT' | 'CHD' | 'INF';
  passengerLabel: string;
  passengerColor: string;
  readOnly?: boolean;
  seat: { price: number; seatLabel: string };
}

async function pickInteractiveSeat(page: import('@playwright/test').Page): Promise<string> {
  const targetSeat = await page
    .locator(
      '.jets-seat.jets-seat--available[data-seat-number], ' +
        '.jets-seat.jets-seat--preferred[data-seat-number], ' +
        '.jets-seat.jets-seat--extra[data-seat-number]'
    )
    .first()
    .getAttribute('data-seat-number');
  if (!targetSeat) throw new Error('No interactive seat found');
  return targetSeat;
}

async function openTooltipFor(page: import('@playwright/test').Page, passenger: Passenger) {
  await setPassengers(page, [passenger]);
  await page
    .locator(`[data-seat-number="${passenger.seat.seatLabel}"].jets-seat--selected`)
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await selectSeat(page, passenger.seat.seatLabel);
  const tooltip = page.locator('.jets-tooltip').first();
  await tooltip.waitFor({ state: 'visible', timeout: 5_000 });
  return tooltip;
}

test.describe('passenger.readOnly', () => {
  test('built-in tooltip renders Unselect disabled and swallows the click', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {});
    const targetSeat = await pickInteractiveSeat(page);

    const tooltip = await openTooltipFor(page, {
      id: '1',
      passengerType: 'ADT',
      passengerLabel: 'Alex Test',
      passengerColor: 'orange',
      readOnly: true,
      seat: { price: 0, seatLabel: targetSeat },
    });

    const unselectBtn = tooltip.locator('.jets-select-btn');
    await expect(unselectBtn).toBeVisible();
    await expect(unselectBtn).toHaveText('Unselect');
    // React parity: the DOM attribute must be present so screen readers and
    // automation see the gate, not just CSS pointer-events.
    await expect(unselectBtn).toBeDisabled();

    // Force-click bypasses Playwright's actionability check but `disabled`
    // still suppresses the native click event — `seatUnselected` must not fire
    // and the seat must keep its passenger.
    await unselectBtn.click({ force: true }).catch(() => {
      /* disabled button rejects the click — that's the expected outcome */
    });

    // Tooltip still up, seat still selected, passenger badge intact.
    await expect(tooltip).toBeVisible();
    await expect(page.locator(`[data-seat-number="${targetSeat}"].jets-seat--selected`)).toBeVisible();

    await screenshotElement(page, __dirname, 'readOnly-tooltip-disabled', '.jets-tooltip');
    await screenshotElement(page, __dirname, 'readOnly-buttons-disabled', '.jets-tooltip--btns-block', 4);
  });

  test('control: non-readOnly occupant keeps Unselect enabled (for side-by-side comparison)', async ({ page }) => {
    await page.goto('/');
    await applyConfigAndReady(page, {});
    const targetSeat = await pickInteractiveSeat(page);

    const tooltip = await openTooltipFor(page, {
      id: '1',
      passengerType: 'ADT',
      passengerLabel: 'Alex Test',
      passengerColor: 'orange',
      seat: { price: 0, seatLabel: targetSeat },
    });

    const unselectBtn = tooltip.locator('.jets-select-btn');
    await expect(unselectBtn).toBeVisible();
    await expect(unselectBtn).toHaveText('Unselect');
    await expect(unselectBtn).toBeEnabled();

    await screenshotElement(page, __dirname, 'control-tooltip-enabled', '.jets-tooltip');
    await screenshotElement(page, __dirname, 'control-buttons-enabled', '.jets-tooltip--btns-block', 4);
  });
});
