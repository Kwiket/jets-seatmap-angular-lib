/**
 * Unit-level a11y smoke tests for `JetsSeatMapComponent`, powered by
 * `jest-axe` (axe-core wrapped in a promise-friendly runner). Each scenario
 * boots the component into a representative state, then runs axe on the
 * rendered native element and asserts that no violations are reported.
 *
 * Why a dedicated spec file (not folded into the main component spec)?
 *   - Keeps the a11y signal isolated so it can be invoked via the
 *     `npm run test:a11y` script (commit 16 / wave G).
 *   - Mirrors the React seatmap repo's `*.a11y.spec.tsx` convention.
 *
 * jsdom caveats:
 *   - jsdom has no real layout, so the `color-contrast` rule is a
 *     false-positive trap. We disable it here and rely on the e2e Playwright
 *     suite (chromium with real paint) to catch real contrast regressions.
 *   - `scrollIntoView` is stubbed exactly as the main spec does.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
// jest-axe ships as CommonJS; vitest's interop resolves the default function.
import { axe } from 'jest-axe';

import { JetsSeatMapComponent } from './jets-seat-map.component';
import { JetsSeatMapService } from '../../services/jets-seat-map.service';
import { IConfig, IDeckData, IFlight, ISeatData } from '../../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../../constants';

// ─── Test-data factories ───────────────────────────────────────────────────
// Kept local (mirrors the helpers in jets-seat-map.component.spec.ts) so
// this file is self-contained and can be invoked through the a11y npm script
// without dragging in the rest of the suite.

function makeFlight(overrides: Partial<IFlight> = {}): IFlight {
  return {
    id: 'a11y-flight-1',
    airlineCode: 'AA',
    flightNo: '100',
    departureDate: '2026-06-01',
    departure: 'JFK',
    arrival: 'LAX',
    cabinClass: 'A',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<IConfig> = {}): IConfig {
  return {
    width: 350,
    lang: 'EN',
    apiUrl: 'https://test.api',
    apiAppId: 'test',
    apiKey: 'key',
    ...overrides,
  };
}

function makeSeat(overrides: Partial<ISeatData> = {}): ISeatData {
  return {
    id: 'seat-x',
    letter: 'A',
    type: ENTITY_TYPE_MAP.seat,
    status: ENTITY_STATUS_MAP.available,
    size: 32,
    number: '1A',
    color: '#4CAF50',
    seatIconType: 0,
    ...overrides,
  };
}

function makeAisle(id = 'aisle-0'): ISeatData {
  return {
    id,
    letter: '',
    type: ENTITY_TYPE_MAP.aisle,
    status: ENTITY_STATUS_MAP.unavailable,
    size: 20,
  };
}

function makeDeck(num: number, seats: ISeatData[]): IDeckData {
  // Bucket seats into rows of at most 3. axe's `aria-required-children`
  // rule fires on rows that render with role="row" but contain no children;
  // building one row per non-empty bucket sidesteps the false-positive trap
  // of a hard-coded two-row layout.
  const rows: IDeckData['rows'] = [];
  const perRow = 3;
  for (let i = 0; i < seats.length; i += perRow) {
    const chunk = seats.slice(i, i + perRow);
    if (chunk.length === 0) continue;
    rows.push({ id: `row-${num}-${rows.length + 1}`, seats: chunk });
  }
  return {
    rows,
    number: num,
    extras: {
      exits: [{ type: 'left', topOffset: 0 }],
      bulks: [],
      noseType: 'default',
    },
  };
}

function makeMockSeatMapService(content: IDeckData[]) {
  return {
    getSeatMapData: vi.fn().mockResolvedValue({ content, media: null, availableCabins: [] }),
    setAvailabilityHandler: vi.fn().mockReturnValue(content),
    setPassengersHandler: vi.fn().mockReturnValue(content),
    selectSeatHandler: vi.fn().mockReturnValue({ data: content, passengers: [] }),
    unselectSeatHandler: vi.fn().mockReturnValue({ data: content, passengers: [] }),
    getNextPassenger: vi.fn().mockReturnValue(null),
    addAbbrToPassengers: vi.fn().mockImplementation((p: unknown[] | undefined) => p ?? []),
    collectAvailableSeats: vi.fn().mockReturnValue([]),
    collectAllSeats: vi.fn().mockReturnValue([]),
    calculateTooltipData: vi.fn().mockImplementation((seat: ISeatData) => ({
      seat,
      top: 100,
      left: 50,
      nextPassenger: null,
      lang: 'EN',
    })),
    getDeckIndexBySeatLabel: vi.fn().mockReturnValue(0),
    compareWithDecksSeatsInfo: vi.fn().mockImplementation((labels: string[]) => ({
      existingSeatLabels: labels?.map(l => l.toUpperCase()) ?? [],
      nonExistingSeatLabels: [],
    })),
  };
}

// axe in jsdom: there is no real layout/paint, so the `color-contrast` rule
// is unreliable (it reports false positives on any element whose computed
// background is the jsdom default `rgba(0,0,0,0)`). Real contrast is
// covered by the e2e suite + the WCAG-AA defaults pinned in commit 4.
async function runAxe(el: Element) {
  return axe(el, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('JetsSeatMapComponent · axe a11y', () => {
  let fixture: ComponentFixture<JetsSeatMapComponent>;
  let component: JetsSeatMapComponent;
  let mockService: ReturnType<typeof makeMockSeatMapService>;

  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  async function setup(decks: IDeckData[], config: IConfig = makeConfig()): Promise<void> {
    mockService = makeMockSeatMapService(decks);
    await TestBed.configureTestingModule({
      imports: [JetsSeatMapComponent, HttpClientTestingModule],
      providers: [{ provide: JetsSeatMapService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsSeatMapComponent);
    component = fixture.componentInstance;
    component.flight = makeFlight();
    component.config = config;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // seatMapInited dispatches via setTimeout(0); flush so all DOM lands.
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders a default-themed single-deck seatmap with no axe violations', async () => {
    const seats = [
      makeSeat({ id: 's-1a', number: '1A', letter: 'A' }),
      makeAisle('aisle-1'),
      makeSeat({ id: 's-1b', number: '1B', letter: 'B' }),
      makeSeat({ id: 's-2a', number: '2A', letter: 'A' }),
      makeAisle('aisle-2'),
      makeSeat({ id: 's-2b', number: '2B', letter: 'B' }),
    ];
    await setup([makeDeck(1, seats)]);

    const results = await runAxe(fixture.nativeElement);
    expect(results.violations).toEqual([]);
  });

  it('renders an open tooltip (dialog + aria-labelledby) with no axe violations', async () => {
    const seats = [
      makeSeat({ id: 's-1a', number: '1A', letter: 'A' }),
      makeAisle('aisle-1'),
      makeSeat({ id: 's-1b', number: '1B', letter: 'B' }),
    ];
    await setup([makeDeck(1, seats)]);

    // Open the built-in tooltip on seat 1A by exercising the public click
    // path — same way the keyboard/mouse user opens it.
    component.onSeatClick({
      seat: makeSeat({ id: 's-1a', number: '1A', letter: 'A' }),
      element: document.createElement('div'),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.activeTooltip).toBeTruthy();
    const results = await runAxe(fixture.nativeElement);
    expect(results.violations).toEqual([]);
  });

  it('renders the alternative list view with no axe violations', async () => {
    const seats = [
      makeSeat({ id: 's-1a', number: '1A', letter: 'A' }),
      makeAisle('aisle-1'),
      makeSeat({ id: 's-1b', number: '1B', letter: 'B' }),
    ];
    await setup([makeDeck(1, seats)]);

    // viewOverride is the public knob the toggle button mutates.
    component.viewOverride = 'list';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.effectiveView).toBe('list');
    const results = await runAxe(fixture.nativeElement);
    expect(results.violations).toEqual([]);
  });

  it('renders a 3-deck selector (role=tablist) with no axe violations', async () => {
    // 3 decks unlocks the tablist branch (N>=3) of the deck selector.
    const seatsFor = (deckN: number): ISeatData[] => [
      makeSeat({ id: `s-${deckN}-1a`, number: `${deckN}A`, letter: 'A' }),
      makeAisle(`aisle-${deckN}`),
      makeSeat({ id: `s-${deckN}-1b`, number: `${deckN}B`, letter: 'B' }),
    ];
    const decks: IDeckData[] = [
      { ...makeDeck(1, seatsFor(1)), title: 'Main' },
      { ...makeDeck(2, seatsFor(2)), title: 'Upper' },
      { ...makeDeck(3, seatsFor(3)), title: 'Lower' },
    ];
    await setup(decks);

    // Sanity: the tablist branch is in the DOM.
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeTruthy();

    const results = await runAxe(fixture.nativeElement);
    expect(results.violations).toEqual([]);
  });
});
