import { expect, test } from '@playwright/test';
import { applyConfigAndReady, setFlight } from '../helpers/demo';

/**
 * Contract proof: `seatMapInited.availabilityData` is **read-only** and
 * carries the server response verbatim — nothing from the integrator-supplied
 * `availability` Input ever leaks into it.
 *
 * Setup:
 *   - Intercept the Quicket sandbox seatmap POST and graft an
 *     `{ id: 'availabilityData', availableSeats: [...] }` marker element onto
 *     whatever the API returns. We previously pinned to EK 2 LHR→DXB because
 *     the sandbox used to emit that block for that flight, but the sandbox
 *     no longer does and the spec lost its anchor. Mocking the marker keeps
 *     the test deterministic regardless of upstream drift.
 *   - Also feed the demo a deliberately unfakeable `availability` Input with
 *     marker values that the API mock will never emit (negative price, non-ISO
 *     currency code, etc.). Any accidental merge would surface them inside
 *     the captured payload.
 *
 * Asserts:
 *   1. `payload.availabilityData` is shaped as `{ availableSeats: [...] }`
 *      (the API contract — IAvailableSeatsData), not as `Array<{ label, ... }>`
 *      (the Input contract — TSeatAvailability).
 *   2. None of the seats inside `availableSeats` reports any of the Input
 *      marker values — Input never leaks into the API-sourced field.
 *   3. The payload object is not even deep-equal to the Input array.
 */

const INPUT_MARKER = {
  CURRENCY: '__INPUT__',
  PRICE: -42,
  LABEL: '__INPUT_ONLY_LABEL__',
  COLOR: '#deadbe',
};

const FAKE_AVAILABILITY_INPUT = [
  {
    label: INPUT_MARKER.LABEL,
    price: INPUT_MARKER.PRICE,
    currency: INPUT_MARKER.CURRENCY,
    color: INPUT_MARKER.COLOR,
  },
];

/**
 * API-sourced marker block grafted into the live response. Values must NOT
 * collide with any INPUT_MARKER field — otherwise the leak-detection assertion
 * below could falsely pass.
 */
const MOCK_AVAILABILITY_BLOCK = {
  id: 'availabilityData',
  availableSeats: [
    { number: '6A', currency: 'USD', price: 75, label: '6A' },
    { number: '6B', currency: 'EUR', price: 80, label: '6B' },
  ],
};

test('availabilityData is read-only and never merges the Input', async ({ page }) => {
  // Intercept the seatmap POST and append the `availabilityData` sibling
  // element. The real sandbox no longer surfaces it for the flight this spec
  // used to pin to; mocking keeps the parity contract assertable.
  await page.route('**/flight/features/plane/seatmap', async route => {
    const upstream = await route.fetch();
    const upstreamJson = (await upstream.json()) as unknown[];
    if (!Array.isArray(upstreamJson)) {
      await route.fulfill({ response: upstream });
      return;
    }
    const augmented = [...upstreamJson, MOCK_AVAILABILITY_BLOCK];
    await route.fulfill({
      response: upstream,
      json: augmented,
    });
  });

  await page.goto('/');

  await setFlight(page, {
    id: '1111',
    airlineCode: 'EK',
    flightNo: '2',
    departureDate: '2026-12-19',
    departure: 'LHR',
    arrival: 'DXB',
    cabinClass: 'E',
    passengerType: 'ADT',
  });

  await applyConfigAndReady(page, { width: 380 }, { availability: FAKE_AVAILABILITY_INPUT });

  // The init payload lands inside the lib's setTimeout(0) — wait for the
  // demo seam to have it.
  await page.waitForFunction(
    () => (window as Window & { __lastSeatMapInited?: unknown }).__lastSeatMapInited != null,
    null,
    { timeout: 25_000 }
  );

  const captured = await page.evaluate(() => {
    const w = window as Window & { __lastSeatMapInited?: { availabilityData?: unknown } };
    // Serialise via JSON to drop any DOM refs and mirror what an integrator
    // actually receives on `seatMapInited`.
    const payloadAvailabilityData = JSON.parse(JSON.stringify(w.__lastSeatMapInited?.availabilityData ?? null));
    return {
      payloadAvailabilityData,
      payloadShapeKeys: payloadAvailabilityData ? Object.keys(payloadAvailabilityData) : [],
    };
  });

  const { payloadAvailabilityData, payloadShapeKeys } = captured;

  // 1) Shape is `{ availableSeats: [...] }` (API contract), not the Input array.
  expect(payloadAvailabilityData).not.toBeNull();
  expect(Array.isArray(payloadAvailabilityData)).toBe(false);
  expect(payloadShapeKeys).toContain('availableSeats');
  expect(Array.isArray((payloadAvailabilityData as { availableSeats?: unknown }).availableSeats)).toBe(true);

  // 2) Nothing from the Input ever surfaces inside the API field.
  const seats = (payloadAvailabilityData as { availableSeats: Array<Record<string, unknown>> }).availableSeats;
  for (const seat of seats) {
    expect(seat['currency']).not.toBe(INPUT_MARKER.CURRENCY);
    expect(seat['price']).not.toBe(INPUT_MARKER.PRICE);
    expect(seat['label']).not.toBe(INPUT_MARKER.LABEL);
    expect(seat['color']).not.toBe(INPUT_MARKER.COLOR);
  }

  // 3) The whole payload object must not deep-equal the Input either.
  expect(payloadAvailabilityData).not.toEqual(FAKE_AVAILABILITY_INPUT);
});
