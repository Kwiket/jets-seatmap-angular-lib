import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { JetsSeatMapComponent } from './jets-seat-map.component';
import { JetsSeatMapService } from '../../services/jets-seat-map.service';
import { resetCachedEnvironmentInfo } from '../../services/environment.service';
import { IConfig, IDeckData, IFlight, IPassenger, ISeatData, IInitialLayoutData, TSeatAvailability } from '../../types';
import { ENTITY_STATUS_MAP, ENTITY_TYPE_MAP } from '../../constants';

// ─── Test data factories ────────────────────────────────────────────────────

function makeFlight(overrides: Partial<IFlight> = {}): IFlight {
  return {
    id: 'test-flight-1',
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
    id: 'seat-0-0',
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

function makeAisle(): ISeatData {
  return {
    id: 'aisle-0-1',
    letter: '',
    type: ENTITY_TYPE_MAP.aisle,
    status: ENTITY_STATUS_MAP.unavailable,
    size: 20,
  };
}

function makeDeckData(seats?: ISeatData[]): IDeckData {
  return {
    rows: [
      {
        id: 'row-0',
        seats: seats ?? [
          makeSeat({ id: 'seat-0-0', number: '1A', letter: 'A' }),
          makeAisle(),
          makeSeat({ id: 'seat-0-2', number: '1B', letter: 'B' }),
        ],
      },
    ],
    number: 1,
    extras: {
      exits: [{ type: 'left', topOffset: 0 }],
      bulks: [],
      noseType: 'default',
    },
  };
}

function makeMultiDeckData(): IDeckData[] {
  return [
    { ...makeDeckData(), number: 1, title: 'Upper deck' },
    {
      rows: [
        {
          id: 'row-1',
          seats: [makeSeat({ id: 'seat-1-0', number: '20A', letter: 'A' })],
        },
      ],
      number: 2,
      title: 'Lower deck',
    },
  ];
}

// ─── Mock JetsSeatMapService ────────────────────────────────────────────────────

function createMockJetsSeatMapService(content: IDeckData[] = [makeDeckData()]) {
  return {
    getSeatMapData: vi.fn().mockResolvedValue({ content, media: null, availableCabins: [] }),
    setAvailabilityHandler: vi.fn().mockReturnValue(content),
    setPassengersHandler: vi.fn().mockReturnValue(content),
    selectSeatHandler: vi.fn().mockReturnValue({ data: content, passengers: [] }),
    unselectSeatHandler: vi.fn().mockReturnValue({ data: content, passengers: [] }),
    getNextPassenger: vi.fn().mockReturnValue(null),
    addAbbrToPassengers: vi.fn().mockImplementation((p: IPassenger[] | undefined) => p ?? []),
    collectAvailableSeats: vi.fn().mockReturnValue([]),
    collectAllSeats: vi.fn().mockReturnValue([]),
    calculateTooltipData: vi.fn().mockReturnValue({
      seat: makeSeat(),
      top: 100,
      left: 50,
      nextPassenger: null,
      lang: 'EN',
    }),
    getDeckIndexBySeatLabel: vi.fn().mockReturnValue(0),
    compareWithDecksSeatsInfo: vi.fn().mockImplementation((labels: string[]) => ({
      existingSeatLabels: labels?.map(l => l.toUpperCase()) ?? [],
      nonExistingSeatLabels: [],
    })),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('JetsSeatMapComponent', () => {
  let fixture: ComponentFixture<JetsSeatMapComponent>;
  let component: JetsSeatMapComponent;
  let mockService: ReturnType<typeof createMockJetsSeatMapService>;

  // jsdom does not implement scrollIntoView — stub it so _jumpToSeat doesn't crash
  // when triggered through ngOnChanges.
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  beforeEach(async () => {
    mockService = createMockJetsSeatMapService();

    await TestBed.configureTestingModule({
      imports: [JetsSeatMapComponent, HttpClientTestingModule],
      providers: [{ provide: JetsSeatMapService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsSeatMapComponent);
    component = fixture.componentInstance;
    component.flight = makeFlight();
    component.config = makeConfig();
  });

  // ─── Rendering tests ───────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should show loading state initially', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      // Before data loads, shows not-init or loading component
      expect(el.querySelector('.jets-seat-map')).toBeTruthy();
    });

    it('should render seat map after data loads', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.isSeatMapInited).toBe(true);
      expect(component.content).toHaveLength(1);
    });

    it('should apply container width from config', async () => {
      component.config = makeConfig({ width: 500 });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const mapEl = fixture.nativeElement.querySelector('.jets-seat-map') as HTMLElement;
      expect(mapEl.style.width).toBe('500px');
    });

    it('should apply background color from color theme', async () => {
      component.config = makeConfig({
        colorTheme: { seatMapBackgroundColor: '#FF0000' },
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const mapEl = fixture.nativeElement.querySelector('.jets-seat-map') as HTMLElement;
      expect(mapEl.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('should show no-data state when content is empty', async () => {
      mockService.getSeatMapData.mockResolvedValue({
        content: [],
        media: null,
        availableCabins: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.isSeatMapInited).toBe(true);
      expect(component.content).toHaveLength(0);
      const noData = fixture.nativeElement.querySelector('sm-jets-no-data');
      expect(noData).toBeTruthy();
    });

    it('should show error message on API failure', async () => {
      mockService.getSeatMapData.mockRejectedValue({
        status: 500,
        message: 'Server Error',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.error).toBeTruthy();
      expect(component.error).toContain('500');
      const errorEl = fixture.nativeElement.querySelector('.jets-seat-map__error');
      expect(errorEl).toBeTruthy();
    });

    it('should not render if flight has no id', async () => {
      component.flight = makeFlight({ id: '' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockService.getSeatMapData).not.toHaveBeenCalled();
    });
  });

  // ─── Prop variations ──────────────────────────────────────────────────

  describe('Prop variations', () => {
    it('should pass availability to service', async () => {
      const availability: TSeatAvailability = [{ label: '1A', price: 50, currency: 'USD' }];
      component.availability = availability;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockService.getSeatMapData).toHaveBeenCalledWith(
        component.flight,
        availability,
        expect.anything(),
        expect.anything()
      );
    });

    it('should pass passengers to service', async () => {
      const passengers: IPassenger[] = [{ id: 'p1', passengerLabel: 'Test' }];
      component.passengers = passengers;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockService.addAbbrToPassengers).toHaveBeenCalledWith(passengers);
    });

    it('should set active deck index from input', () => {
      component.currentDeckIndex = 1;
      fixture.detectChanges();
      expect(component.activeDeckIndex).toBe(1);
    });

    it('should apply horizontal transform when config.horizontal is true', () => {
      component.config = makeConfig({ horizontal: true });
      fixture.detectChanges();

      expect(component.mapTransform).toContain('rotate(90deg)');
    });

    it('should not mirror seat layout when config.rightToLeft is true', () => {
      component.config = makeConfig({ rightToLeft: true });
      fixture.detectChanges();

      // RTL should NOT apply CSS direction to the container — that would
      // flip the row order and mirror seat labels. RTL affects only tooltip
      // text and horizontal-mode orientation.
      const containerEl = fixture.nativeElement.querySelector('.jets-seat-map');
      expect(containerEl?.style?.direction || '').toBe('');
      expect(component.resolvedConfig.rightToLeft).toBe(true);
    });

    it('should default builtInTooltip to true', () => {
      expect(component.resolvedConfig.builtInTooltip).toBe(true);
    });

    it('should default builtInDeckSelector to true', () => {
      expect(component.resolvedConfig.builtInDeckSelector).toBe(true);
    });

    it('should default visibleFuselage to true', () => {
      expect(component.resolvedConfig.visibleFuselage).toBe(true);
    });

    it('should use provided lang', () => {
      component.config = makeConfig({ lang: 'DE' });
      expect(component.lang).toBe('DE');
    });

    it('should default to EN lang', () => {
      expect(component.lang).toBe('EN');
    });
  });

  // ─── Output events ────────────────────────────────────────────────────

  describe('Output events', () => {
    it('should emit seatMapInited after successful load', async () => {
      const spy = vi.fn();
      component.seatMapInited.subscribe(spy);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      // seatMapInited is dispatched via setTimeout(0) to capture DOM size
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          decksCount: 1,
          currentDeckIndex: 0,
        })
      );
    });

    it('should emit layoutUpdated after load', async () => {
      const spy = vi.fn();
      component.layoutUpdated.subscribe(spy);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(spy).toHaveBeenCalled();
    });

    it('should emit loadError on API failure', async () => {
      mockService.getSeatMapData.mockRejectedValue({ status: 403, message: 'Forbidden' });

      const spy = vi.fn();
      component.loadError.subscribe(spy);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain('403');
    });

    it('should emit tooltipRequested on seat click', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const spy = vi.fn();
      component.tooltipRequested.subscribe(spy);

      const seat = makeSeat();
      const el = document.createElement('div');
      component.onSeatClick({ seat, element: el });

      // Public emit shape mirrors the React-parity integrator contract:
      //   - `number → label`, layout-only fields (`id`, `size`, `topOffset`,
      //     `leftOffset`, `cabinTitle`) stripped.
      //   - `classType` becomes the full word ('Economy', 'Business', …).
      //   - `priceValue` carries the raw number; `price` becomes a formatted string.
      //   - features/measurements default to empty arrays.
      //   - `passengerTypes` defaults to React's `['ADT', 'CHD', 'INF']`.
      //   - `rotation` is present and defaults to 'n' (React fixtures).
      const { id: _id, size: _size, number: _number, ...rest } = seat;
      const expectedSeat = {
        ...rest,
        label: seat.number,
        classCode: 'E',
        classType: 'Economy',
        color: seat.color,
        originalColor: seat.color,
        passengerTypes: ['ADT', 'CHD', 'INF'],
        rotation: 'n',
        features: [],
        measurements: [],
        additionalProps: [],
      };
      expect(spy).toHaveBeenCalledWith({ seat: expectedSeat, element: el, event: undefined });
    });

    it('should emit seatSelected after seat selection', async () => {
      const updatedPassengers = [{ id: 'p1', seat: { price: 50, seatLabel: '1A' } }];
      mockService.selectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: updatedPassengers,
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatSelected.subscribe(spy);

      component.onTooltipSelect(makeSeat());
      expect(spy).toHaveBeenCalledWith(updatedPassengers);
    });

    it('should emit seatUnselected after seat unselection', async () => {
      const updatedPassengers = [{ id: 'p1' }];
      mockService.unselectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: updatedPassengers,
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatUnselected.subscribe(spy);

      component.onTooltipUnselect(makeSeat());
      expect(spy).toHaveBeenCalledWith(updatedPassengers);
    });

    it('onTooltipUnselect is a no-op when the occupant is readOnly (React parity)', async () => {
      // React parity: TooltipGlobal.view.js disables the Unselect button, and
      // the SeatMap container itself never reaches unselectSeatHandler for a
      // readOnly passenger. This test guards the container path: even if a
      // viewOverride dispatched the click, we must not unseat the passenger.
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const spy = vi.fn();
      component.seatUnselected.subscribe(spy);

      const readOnlyOccupant: IPassenger = { id: 'p0', passengerLabel: 'Alex', readOnly: true };
      component.onTooltipUnselect(makeSeat({ passenger: readOnlyOccupant }));

      expect(spy).not.toHaveBeenCalled();
      expect(mockService.unselectSeatHandler).not.toHaveBeenCalled();
    });

    it('should emit deckChanged on deck selection', () => {
      const spy = vi.fn();
      component.deckChanged.subscribe(spy);

      component.onDeckSelect(1);
      expect(spy).toHaveBeenCalledWith(1);
      expect(component.activeDeckIndex).toBe(1);
    });

    it('should emit seatMouseEnter', () => {
      const spy = vi.fn();
      component.seatMouseEnter.subscribe(spy);

      const event = { seat: makeSeat(), element: document.createElement('div') };
      component.onSeatMouseEnter(event);
      expect(spy).toHaveBeenCalledWith(event);
    });

    // React parity (JetsSeat.js:128-129, SeatMap.js:408-414): the outward
    // `onSeatMouseLeave` callback only fires through `onTooltipClose`, and the
    // DOM mouseleave listener that calls it is attached only when
    // `tooltipOnHover === true`. The React test
    // `JetsSeat.integration.test.js:38-54` codifies this — "should not trigger
    // onMouseEnter and onMouseLeave handlers by default".
    it('should emit seatMouseLeave with the enriched (prepared) seat shape when tooltipOnHover=true', () => {
      component.config = makeConfig({ tooltipOnHover: true });
      const spy = vi.fn();
      component.seatMouseLeave.subscribe(spy);

      const seat = makeSeat();
      const element = document.createElement('div');
      component.onSeatMouseLeave({ seat, element });

      // React-parity: mouseLeave runs through prepareSeatDataForEmit, so the
      // payload uses the public shape (`label`, full `classType`, default
      // passengerTypes, empty arrays) — not the raw internal seat.
      expect(spy).toHaveBeenCalledTimes(1);
      const arg = spy.mock.calls[0][0];
      expect(arg.element).toBe(element);
      expect(arg.seat.label).toBe(seat.number);
      expect(arg.seat.classType).toBe('Economy');
      expect(arg.seat.passengerTypes).toEqual(['ADT', 'CHD', 'INF']);
      expect(arg.seat.features).toEqual([]);
      expect(arg.seat).not.toHaveProperty('id');
      expect(arg.seat).not.toHaveProperty('size');
      // React-parity: rotation is present with 'n' (north / no-rotation) default.
      expect(arg.seat.rotation).toBe('n');
    });

    it('should NOT emit seatMouseLeave when tooltipOnHover is unset/false', () => {
      // Default config has no tooltipOnHover — emit must be suppressed.
      const spy = vi.fn();
      component.seatMouseLeave.subscribe(spy);

      component.onSeatMouseLeave({ seat: makeSeat(), element: document.createElement('div') });
      expect(spy).not.toHaveBeenCalled();

      component.config = makeConfig({ tooltipOnHover: false });
      component.onSeatMouseLeave({ seat: makeSeat(), element: document.createElement('div') });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Multi-deck support ───────────────────────────────────────────────

  describe('Multi-deck support', () => {
    beforeEach(async () => {
      const multiDeck = makeMultiDeckData();
      mockService.getSeatMapData.mockResolvedValue({
        content: multiDeck,
        media: null,
        availableCabins: [],
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should render multiple decks', () => {
      expect(component.content).toHaveLength(2);
    });

    it('should show deck numbers for multi-deck', () => {
      expect(component.showDeckNumbers).toBe(true);
    });

    it('should show deck selector by default for multi-deck', () => {
      expect(component.showDeckSelector).toBe(true);
    });

    it('should switch decks when onDeckSelect is called', () => {
      component.onDeckSelect(1);
      expect(component.activeDeckIndex).toBe(1);
    });

    it('should show single deck in singleDeckMode', () => {
      component.config = makeConfig({ singleDeckMode: true });
      expect(component.visibleDecks).toHaveLength(1);
    });

    it('should hide deck selector when builtInDeckSelector is false', () => {
      component.config = makeConfig({ builtInDeckSelector: false });
      expect(component.showDeckSelector).toBe(false);
    });
  });

  // ─── Tooltip state ────────────────────────────────────────────────────

  describe('Tooltip', () => {
    it('should open tooltip on seat click', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      expect(component.activeTooltip).toBeTruthy();
    });

    it('should close tooltip on onTooltipClose', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      expect(component.activeTooltip).toBeTruthy();

      component.onTooltipClose();
      expect(component.activeTooltip).toBeNull();
    });

    it('should close tooltip on deck switch', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      component.onDeckSelect(1);
      expect(component.activeTooltip).toBeNull();
    });

    it('should close tooltip after seat selection', async () => {
      mockService.selectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: [],
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      component.onTooltipSelect(makeSeat());
      expect(component.activeTooltip).toBeNull();
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle undefined availability gracefully', async () => {
      component.availability = undefined;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isSeatMapInited).toBe(true);
    });

    it('should handle undefined passengers gracefully', async () => {
      component.passengers = undefined;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isSeatMapInited).toBe(true);
    });

    it('should handle empty flight object', async () => {
      component.flight = makeFlight({ id: '' });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockService.getSeatMapData).not.toHaveBeenCalled();
    });

    it('should ignore stale responses after flight change', async () => {
      // Start first load
      let resolveFirst: (v: { content: IDeckData[]; media: null; availableCabins: never[] }) => void;
      const firstPromise = new Promise<{
        content: IDeckData[];
        media: null;
        availableCabins: never[];
      }>(r => (resolveFirst = r));
      mockService.getSeatMapData.mockReturnValueOnce(firstPromise);

      fixture.detectChanges();

      // Change flight before first load completes
      const secondContent = [makeDeckData([makeSeat({ number: '99Z' })])];
      mockService.getSeatMapData.mockResolvedValueOnce({
        content: secondContent,
        media: null,
        availableCabins: [],
      });

      component.flight = makeFlight({ id: 'flight-2' });
      component.ngOnChanges({
        flight: {
          currentValue: component.flight,
          previousValue: makeFlight(),
          firstChange: false,
          isFirstChange: () => false,
        },
      });

      await fixture.whenStable();
      fixture.detectChanges();

      // Resolve stale first request
      resolveFirst!({ content: [makeDeckData()], media: null, availableCabins: [] });
      await fixture.whenStable();
      fixture.detectChanges();

      // Should use second flight's data, not stale first
      expect(component.content).toEqual(secondContent);
    });

    it('should not crash with empty decks array from API', async () => {
      mockService.getSeatMapData.mockResolvedValue({
        content: [],
        media: null,
        availableCabins: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.content).toEqual([]);
      expect(component.isSeatMapInited).toBe(true);
    });
  });

  // ─── React-parity API ─────────────────────────────────────────────────

  describe('availabilityApplied (React parity)', () => {
    async function ready() {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));
    }

    it('should emit availabilityApplied when availability changes via ngOnChanges', async () => {
      await ready();
      const spy = vi.fn();
      component.availabilityApplied.subscribe(spy);

      component.availability = [
        { label: '1A', price: 10, currency: 'USD' },
        { label: '1B', price: 10, currency: 'USD' },
      ];
      mockService.compareWithDecksSeatsInfo.mockReturnValueOnce({
        existingSeatLabels: ['1A', '1B'],
        nonExistingSeatLabels: [],
      });
      component.ngOnChanges({
        availability: {
          currentValue: component.availability,
          previousValue: undefined,
          firstChange: false,
          isFirstChange: () => false,
        } as any,
      });

      expect(spy).toHaveBeenCalledWith({
        existingSeatLabels: ['1A', '1B'],
        nonExistingSeatLabels: [],
      });
    });

    it('should exclude wildcard entries from compared labels', async () => {
      await ready();
      const spy = vi.fn();
      component.availabilityApplied.subscribe(spy);

      component.availability = [
        { label: '*', price: 5, currency: 'USD' },
        { label: '1A', price: 10, currency: 'USD' },
      ];
      component.ngOnChanges({
        availability: {
          currentValue: component.availability,
          previousValue: undefined,
          firstChange: false,
          isFirstChange: () => false,
        } as any,
      });

      expect(mockService.compareWithDecksSeatsInfo).toHaveBeenLastCalledWith(['1A'], component.content);
    });

    it('should NOT emit availabilityApplied when availability is cleared', async () => {
      component.availability = [{ label: '1A', price: 10, currency: 'USD' }];
      await ready();
      const spy = vi.fn();
      component.availabilityApplied.subscribe(spy);

      component.availability = undefined;
      component.ngOnChanges({
        availability: {
          currentValue: undefined,
          previousValue: [{ label: '1A', price: 10, currency: 'USD' }],
          firstChange: false,
          isFirstChange: () => false,
        } as any,
      });
      await fixture.whenStable();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('seatMouseClick (external management + hover tooltip mode)', () => {
    // jsdom's HTMLElement prototype has `ontouchstart`, so the default
    // environment reads as touch. The contract here is non-touch-only, so we
    // force the env and reset the cached signal before each test.
    let savedDescriptor: PropertyDescriptor | undefined;
    let hadOntouchstart = false;

    beforeEach(() => {
      resetCachedEnvironmentInfo();
      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      hadOntouchstart = Object.prototype.hasOwnProperty.call(proto, 'ontouchstart');
      if (hadOntouchstart) {
        savedDescriptor = Object.getOwnPropertyDescriptor(proto, 'ontouchstart');
        delete proto['ontouchstart'];
      }
      Object.defineProperty(navigator, 'maxTouchPoints', {
        configurable: true,
        get: () => 0,
      });
    });

    afterEach(() => {
      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      if (hadOntouchstart && savedDescriptor) {
        Object.defineProperty(proto, 'ontouchstart', savedDescriptor);
      }
      resetCachedEnvironmentInfo();
    });

    async function ready() {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));
    }

    it('should emit seatMouseClick and skip tooltipRequested in external+hover mode', async () => {
      component.config = makeConfig({
        externalPassengerManagement: true,
        tooltipOnHover: true,
        builtInTooltip: false,
      });
      await ready();

      const clickSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatMouseClick.subscribe(clickSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      const evt = new MouseEvent('click');
      const seat = makeSeat();
      const element = document.createElement('div');
      component.onSeatClick({ seat, element, event: evt });

      expect(clickSpy).toHaveBeenCalledTimes(1);
      // React-parity: seatMouseClick runs through prepareSeatDataForEmit, so
      // the seat is the public enriched shape (full classType, default
      // passengerTypes), not the raw internal seat.
      const arg = clickSpy.mock.calls[0][0];
      expect(arg.element).toBe(element);
      expect(arg.event).toBe(evt);
      expect(arg.seat.label).toBe(seat.number);
      expect(arg.seat.classType).toBe('Economy');
      expect(arg.seat.passengerTypes).toEqual(['ADT', 'CHD', 'INF']);
      // React-parity: rotation default 'n' is part of the emit shape.
      expect(arg.seat.rotation).toBe('n');
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(component.activeTooltip).toBeNull();
    });

    it('should NOT emit seatMouseClick in default click mode', async () => {
      await ready();

      const clickSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatMouseClick.subscribe(clickSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });

      expect(clickSpy).not.toHaveBeenCalled();
      expect(tooltipSpy).toHaveBeenCalled();
    });

    it('should emit seatMouseClick even when builtInTooltip is left at its default (true)', async () => {
      // Regression: React's onSeatMouseClick branch does NOT check builtInTooltip
      // (SeatMap.js:303-308 has the equivalent guard commented out). Earlier the
      // Angular port mistakenly required `builtInTooltip === false`, so consumers
      // who flipped only externalPassengerManagement + tooltipOnHover saw two
      // tooltipRequested events instead of seatMouseClick.
      component.config = makeConfig({
        externalPassengerManagement: true,
        tooltipOnHover: true,
        // builtInTooltip left undefined → resolves to true
      });
      await ready();

      const clickSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatMouseClick.subscribe(clickSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatClick({
        seat: makeSeat(),
        element: document.createElement('div'),
        event: new MouseEvent('click'),
      });

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(component.activeTooltip).toBeNull();
    });

    it('should emit tooltipRequested (not seatMouseClick) on hover in external+hover mode', async () => {
      // Hovering goes through `_showTooltip` directly — mirroring React's
      // JetsSeat.js, where mouseEnter calls `showTooltip`, not `onSeatClick`.
      component.config = makeConfig({
        externalPassengerManagement: true,
        tooltipOnHover: true,
      });
      await ready();

      const clickSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatMouseClick.subscribe(clickSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
        event: new MouseEvent('mouseenter'),
      });

      expect(clickSpy).not.toHaveBeenCalled();
      expect(tooltipSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Click-select in hover mode without external passenger management ──
  //
  // React parity (SeatMap.js:299-325): when `tooltipOnHover` is on and
  // `externalPassengerManagement` is OFF on a non-touch device, a click on
  // a seat directly (un)selects it without going through the tooltip. This
  // covers rows 2 and 3 of the configuration table:
  //   row 2: builtInTooltip:true,  tooltipOnHover:true → hover shows tooltip,
  //          click selects.
  //   row 3: builtInTooltip:false, tooltipOnHover:true → no tooltip,
  //          click selects.
  describe('seat click select/unselect (tooltipOnHover, internal management)', () => {
    let savedDescriptor: PropertyDescriptor | undefined;
    let hadOntouchstart = false;

    beforeEach(() => {
      resetCachedEnvironmentInfo();
      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      hadOntouchstart = Object.prototype.hasOwnProperty.call(proto, 'ontouchstart');
      if (hadOntouchstart) {
        savedDescriptor = Object.getOwnPropertyDescriptor(proto, 'ontouchstart');
        delete proto['ontouchstart'];
      }
      Object.defineProperty(navigator, 'maxTouchPoints', {
        configurable: true,
        get: () => 0,
      });
    });

    afterEach(() => {
      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      if (hadOntouchstart && savedDescriptor) {
        Object.defineProperty(proto, 'ontouchstart', savedDescriptor);
      }
      resetCachedEnvironmentInfo();
    });

    async function ready() {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));
    }

    it('row 2 (builtInTooltip:true, tooltipOnHover:true): click selects the seat instead of opening tooltip', async () => {
      const passenger: IPassenger = { id: 'p1', passengerLabel: 'A' };
      mockService.getNextPassenger.mockReturnValue(passenger);
      mockService.selectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: [{ ...passenger, seat: { price: 0, seatLabel: '1A' } }],
      });
      component.config = makeConfig({
        builtInTooltip: true,
        tooltipOnHover: true,
        externalPassengerManagement: false,
      });
      await ready();

      const selectedSpy = vi.fn();
      const tooltipSpy = vi.fn();
      const clickSpy = vi.fn();
      component.seatSelected.subscribe(selectedSpy);
      component.tooltipRequested.subscribe(tooltipSpy);
      component.seatMouseClick.subscribe(clickSpy);

      const seat = makeSeat();
      component.onSeatClick({ seat, element: document.createElement('div') });

      expect(selectedSpy).toHaveBeenCalledTimes(1);
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
      expect(component.activeTooltip).toBeNull();
      expect(mockService.selectSeatHandler).toHaveBeenCalled();
    });

    it('row 3 (builtInTooltip:false, tooltipOnHover:true): click selects the seat with no tooltip', async () => {
      const passenger: IPassenger = { id: 'p1', passengerLabel: 'A' };
      mockService.getNextPassenger.mockReturnValue(passenger);
      mockService.selectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: [{ ...passenger, seat: { price: 0, seatLabel: '1A' } }],
      });
      component.config = makeConfig({
        builtInTooltip: false,
        tooltipOnHover: true,
        externalPassengerManagement: false,
      });
      await ready();

      const selectedSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatSelected.subscribe(selectedSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });

      expect(selectedSpy).toHaveBeenCalledTimes(1);
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(component.activeTooltip).toBeNull();
    });

    it('click on a seat that already has a passenger unselects it (no tooltipRequested)', async () => {
      const occupant: IPassenger = { id: 'p0', passengerLabel: 'X' };
      mockService.unselectSeatHandler.mockReturnValue({ data: [makeDeckData()], passengers: [] });
      component.config = makeConfig({
        builtInTooltip: true,
        tooltipOnHover: true,
        externalPassengerManagement: false,
      });
      await ready();

      const unselectedSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatUnselected.subscribe(unselectedSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      const seat = makeSeat({ passenger: occupant });
      component.onSeatClick({ seat, element: document.createElement('div') });

      expect(unselectedSpy).toHaveBeenCalledTimes(1);
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(mockService.unselectSeatHandler).toHaveBeenCalled();
    });

    it('click on a readOnly-passenger seat is a no-op (no select, unselect, or tooltipRequested)', async () => {
      // React parity: SeatMap.js:312-314 — readOnly passenger blocks unselect.
      const occupant = { id: 'p0', passengerLabel: 'X', readOnly: true } as IPassenger;
      component.config = makeConfig({
        builtInTooltip: true,
        tooltipOnHover: true,
        externalPassengerManagement: false,
      });
      await ready();

      const unselectedSpy = vi.fn();
      const selectedSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatUnselected.subscribe(unselectedSpy);
      component.seatSelected.subscribe(selectedSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      const seat = makeSeat({ passenger: occupant });
      component.onSeatClick({ seat, element: document.createElement('div') });

      expect(unselectedSpy).not.toHaveBeenCalled();
      expect(selectedSpy).not.toHaveBeenCalled();
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(mockService.unselectSeatHandler).not.toHaveBeenCalled();
    });

    it('click is a no-op when there is no next passenger to seat (no tooltipRequested either)', async () => {
      // React's isSeatSelectDisabled returns true when there's nobody to seat —
      // the click silently aborts. The tooltipRequested fallback must NOT fire.
      mockService.getNextPassenger.mockReturnValue(null);
      component.config = makeConfig({
        builtInTooltip: true,
        tooltipOnHover: true,
        externalPassengerManagement: false,
      });
      await ready();

      const selectedSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatSelected.subscribe(selectedSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });

      expect(selectedSpy).not.toHaveBeenCalled();
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(mockService.selectSeatHandler).not.toHaveBeenCalled();
    });

    it('click is a no-op when next passenger type does not match seat.passengerTypes', async () => {
      // React parity: isSeatSelectDisabled also rejects when next passenger's
      // type isn't allowed on the seat.
      const passenger: IPassenger = { id: 'p1', passengerLabel: 'A', passengerType: 'INF' };
      mockService.getNextPassenger.mockReturnValue(passenger);
      component.config = makeConfig({
        builtInTooltip: true,
        tooltipOnHover: true,
        externalPassengerManagement: false,
      });
      await ready();

      const selectedSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatSelected.subscribe(selectedSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      const seat = makeSeat({ passengerTypes: ['ADT'] });
      component.onSeatClick({ seat, element: document.createElement('div') });

      expect(selectedSpy).not.toHaveBeenCalled();
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(mockService.selectSeatHandler).not.toHaveBeenCalled();
    });
  });

  describe('seatJumpTo @Input tracking', () => {
    function makeSeatJumpToChange(curr: unknown, prev: unknown) {
      return {
        seatJumpTo: {
          currentValue: curr,
          previousValue: prev,
          firstChange: prev === undefined,
          isFirstChange: () => prev === undefined,
        } as any,
      };
    }

    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));
    });

    it('should jump when seatJumpTo is set after init', () => {
      const spy = vi.spyOn(component as any, '_jumpToSeat').mockImplementation(() => {});
      component.seatJumpTo = { seatLabel: '1A' };
      component.ngOnChanges(makeSeatJumpToChange({ seatLabel: '1A' }, undefined));
      expect(spy).toHaveBeenCalledWith('1A');
    });

    it('should NOT re-jump when the same seatLabel is assigned twice', () => {
      component.seatJumpTo = { seatLabel: '1A' };
      component.ngOnChanges(makeSeatJumpToChange({ seatLabel: '1A' }, undefined));

      const spy = vi.spyOn(component as any, '_jumpToSeat').mockImplementation(() => {});
      component.seatJumpTo = { seatLabel: '1A' };
      component.ngOnChanges(makeSeatJumpToChange({ seatLabel: '1A' }, { seatLabel: '1A' }));
      expect(spy).not.toHaveBeenCalled();
    });

    it('should NOT jump on unrelated config-only changes', () => {
      const spy = vi.spyOn(component as any, '_jumpToSeat').mockImplementation(() => {});
      const next = makeConfig({ colorTheme: { floorColor: '#000' } });
      component.config = next;
      component.ngOnChanges({
        config: {
          currentValue: next,
          previousValue: makeConfig(),
          firstChange: false,
          isFirstChange: () => false,
        } as any,
      });
      expect(spy).not.toHaveBeenCalled();
    });

    it('should reset tracking when seatJumpTo is cleared, allowing the same label later', () => {
      component.seatJumpTo = { seatLabel: '1A' };
      component.ngOnChanges(makeSeatJumpToChange({ seatLabel: '1A' }, undefined));

      component.seatJumpTo = undefined;
      component.ngOnChanges(makeSeatJumpToChange(undefined, { seatLabel: '1A' }));

      const spy = vi.spyOn(component as any, '_jumpToSeat').mockImplementation(() => {});
      component.seatJumpTo = { seatLabel: '1A' };
      component.ngOnChanges(makeSeatJumpToChange({ seatLabel: '1A' }, undefined));
      expect(spy).toHaveBeenCalledWith('1A');
    });
  });

  describe('componentOverrides', () => {
    it('should expose all four override slots through resolvedConfig', () => {
      // Use plain classes only as identity markers; we never render them in this test,
      // so we don't need @Component decorators.
      class FakeSeat {}
      class FakeTooltip {}
      class FakeTooltipView {}
      class FakeNotInit {}
      component.config = makeConfig({
        componentOverrides: {
          JetsSeat: FakeSeat as any,
          JetsTooltip: FakeTooltip as any,
          JetsTooltipView: FakeTooltipView as any,
          JetsNotInit: FakeNotInit as any,
        },
      });

      // No detectChanges() — avoid NgComponentOutlet rendering the fake classes.
      expect(component.seatOverride).toBe(FakeSeat);
      expect(component.tooltipOverride).toBe(FakeTooltip);
      expect(component.tooltipViewOverride).toBe(FakeTooltipView);
      expect(component.notInitOverride).toBe(FakeNotInit);
    });

    it('should return null for override getters when componentOverrides is unset', () => {
      // detectChanges is safe here because no overrides are set.
      fixture.detectChanges();
      expect(component.seatOverride).toBeNull();
      expect(component.tooltipOverride).toBeNull();
      expect(component.tooltipViewOverride).toBeNull();
      expect(component.notInitOverride).toBeNull();
    });
  });

  describe('Extended payloads (React parity)', () => {
    async function load() {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));
    }

    it('should emit layoutUpdated with ILayoutData fields', async () => {
      const spy = vi.fn();
      component.layoutUpdated.subscribe(spy);
      await load();

      expect(spy).toHaveBeenCalledTimes(1);
      const payload = spy.mock.calls[0][0];
      expect(payload).toMatchObject({
        decksCount: 1,
        currentDeckIndex: 0,
      });
      expect(typeof payload.heightInPx).toBe('number');
      expect(typeof payload.widthInPx).toBe('number');
      expect(typeof payload.scaleFactor).toBe('number');
    });

    it('should re-emit layoutUpdated on onDeckSelect with the new currentDeckIndex', async () => {
      mockService.getSeatMapData.mockResolvedValue({
        content: makeMultiDeckData(),
        media: null,
        availableCabins: [],
      });
      const spy = vi.fn();
      component.layoutUpdated.subscribe(spy);
      await load();
      spy.mockClear();

      component.onDeckSelect(1);
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatchObject({ currentDeckIndex: 1, decksCount: 2 });
    });

    it('should re-emit layoutUpdated when currentDeckIndex Input changes', async () => {
      mockService.getSeatMapData.mockResolvedValue({
        content: makeMultiDeckData(),
        media: null,
        availableCabins: [],
      });
      const spy = vi.fn();
      component.layoutUpdated.subscribe(spy);
      await load();
      spy.mockClear();

      component.currentDeckIndex = 1;
      component.ngOnChanges({
        currentDeckIndex: {
          previousValue: 0,
          currentValue: 1,
          firstChange: false,
          isFirstChange: () => false,
        },
      } as any);
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatchObject({ currentDeckIndex: 1 });
    });

    it('should emit layoutUpdated with scaleFactor of active deck (not deck 0)', async () => {
      mockService.getSeatMapData.mockResolvedValue({
        content: [
          { ...makeDeckData(), number: 1, scale: 0.5 },
          { ...makeDeckData(), number: 2, scale: 0.8 },
        ],
        media: null,
        availableCabins: [],
      });
      const spy = vi.fn();
      component.layoutUpdated.subscribe(spy);
      await load();
      spy.mockClear();

      component.onDeckSelect(1);
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));

      expect(spy.mock.calls[0][0].scaleFactor).toBe(0.8);
    });

    it('should emit seatMapInited with new public contract (allCabins, availabilityData, no legacy fields)', async () => {
      mockService.getSeatMapData.mockResolvedValue({
        content: [makeDeckData()],
        media: { photoData: [] },
        availableCabins: [{ code: 'E', title: 'Economy' }],
      });

      const spy = vi.fn();
      component.seatMapInited.subscribe(spy);
      await load();

      const payload = spy.mock.calls[0][0];
      expect(payload).toMatchObject({
        decksCount: 1,
        currentDeckIndex: 0,
        allCabins: [{ code: 'E', title: 'Economy' }],
        media: { photoData: [] },
      });
      expect(typeof payload.heightInPx).toBe('number');
      expect(typeof payload.widthInPx).toBe('number');
      expect(typeof payload.scaleFactor).toBe('number');

      // availabilityData key is always present (mirrors React); undefined when no Input
      expect('availabilityData' in payload).toBe(true);
      expect(payload.availabilityData).toBeUndefined();

      // error key omitted entirely when no error (React parity)
      expect('error' in payload).toBe(false);

      // Removed legacy Angular-only fields
      expect('availableSeats' in payload).toBe(false);
      expect('allSeats' in payload).toBe(false);
      expect('availableCabins' in payload).toBe(false);
    });

    it('should emit availabilityData from the API response (NOT from the availability Input)', async () => {
      // The `availability` Input controls per-seat status/colour overrides
      // (see `JetsSeatMapService.setAvailabilityHandler`). The `availabilityData`
      // emitted on `seatMapInited` is a different beast: it's the read-only
      // `{ availableSeats: [...] }` block that the Quicket API ships in its
      // response array (React parity — api.js:101-104). Mixing the two was the
      // bug behind "Fix: onSeatMapInited object data".
      const apiAvailabilityData = {
        availableSeats: [
          { label: '53H', currency: 'EUR', price: 0 },
          { label: '53J', currency: 'EUR', price: 0 },
        ],
      };
      mockService.getSeatMapData.mockResolvedValue({
        content: [makeDeckData()],
        media: null,
        availableCabins: [],
        availabilityData: apiAvailabilityData,
      });

      // Set the Input too, to prove it does NOT leak into payload.availabilityData.
      component.availability = [{ label: '1A', price: 10, currency: 'EUR' }] as TSeatAvailability;

      const spy = vi.fn();
      component.seatMapInited.subscribe(spy);
      await load();

      const payload = spy.mock.calls[0][0];
      expect(payload.availabilityData).toBe(apiAvailabilityData);
      // Sanity: the per-seat Input must not have been smuggled in.
      expect(payload.availabilityData).not.toEqual(component.availability);
    });

    it('should emit heightInPx/widthInPx as native (rendered = value × scaleFactor)', async () => {
      // jsdom's getBoundingClientRect returns zeros; stub it to a known rendered size
      // so we can assert the inverse-scale calculation. The contract says:
      //   heightInPx × scaleFactor === rendered pixels
      const fakeRect: DOMRect = {
        width: 200,
        height: 1000,
        top: 0,
        left: 0,
        right: 200,
        bottom: 1000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
      const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(fakeRect);

      try {
        mockService.getSeatMapData.mockResolvedValue({
          content: [{ ...makeDeckData(), scale: 0.5 }],
          media: null,
          availableCabins: [],
        });

        const spy = vi.fn();
        component.seatMapInited.subscribe(spy);
        await load();

        const payload = spy.mock.calls[0][0];
        expect(payload.scaleFactor).toBe(0.5);
        // 1000 (rendered) / 0.5 (scale) = 2000 (native)
        expect(payload.heightInPx).toBe(2000);
        // 200 (rendered) / 0.5 (scale) = 400 (native)
        expect(payload.widthInPx).toBe(400);
      } finally {
        rectSpy.mockRestore();
      }
    });

    it('should NOT emit seatMapInited when load fails', async () => {
      mockService.getSeatMapData.mockRejectedValue({ status: 500, message: 'oops' });
      const spy = vi.fn();
      component.seatMapInited.subscribe(spy);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));

      expect(spy).not.toHaveBeenCalled();
    });

    it('should propagate DOM event in tooltipRequested payload', async () => {
      await load();
      const spy = vi.fn();
      component.tooltipRequested.subscribe(spy);

      const evt = new MouseEvent('click');
      component.onSeatClick({
        seat: makeSeat(),
        element: document.createElement('div'),
        event: evt,
      });
      expect(spy.mock.calls[0][0].event).toBe(evt);
    });
  });

  describe('Additional @Output events', () => {
    async function load() {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(r => setTimeout(r, 0));
    }

    it('should emit activeTooltipChanged on seat click and on close', async () => {
      await load();
      const spy = vi.fn();
      component.activeTooltipChanged.subscribe(spy);

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      expect(spy).toHaveBeenCalled();
      const lastOpen = spy.mock.calls[spy.mock.calls.length - 1][0];
      expect(lastOpen).not.toBeNull();

      component.onTooltipClose();
      expect(spy.mock.calls[spy.mock.calls.length - 1][0]).toBeNull();
    });

    it('should emit legendReady after load', async () => {
      const spy = vi.fn();
      component.legendReady.subscribe(spy);
      await load();
      expect(spy).toHaveBeenCalled();
    });

    it('should emit mediaReady after load', async () => {
      mockService.getSeatMapData.mockResolvedValue({
        content: [makeDeckData()],
        media: { photoData: [{ file: 'a.jpg', thumb: 'a.jpg' }] },
        availableCabins: [],
      });
      const spy = vi.fn();
      component.mediaReady.subscribe(spy);
      await load();
      expect(spy).toHaveBeenCalledWith({ photoData: [{ file: 'a.jpg', thumb: 'a.jpg' }] });
    });

    it('should emit passengersChanged after load', async () => {
      const spy = vi.fn();
      component.passengersChanged.subscribe(spy);
      await load();
      expect(spy).toHaveBeenCalled();
    });

    it('should emit currencyDetected after load', async () => {
      const spy = vi.fn();
      component.currencyDetected.subscribe(spy);
      await load();
      expect(spy).toHaveBeenCalled();
    });

    it('should emit hasAvailabilityChanged after load', async () => {
      const spy = vi.fn();
      component.hasAvailabilityChanged.subscribe(spy);
      component.availability = [{ label: '1A', price: 10, currency: 'USD' }];
      await load();
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('should emit availabilityApplied after initial load when availability is provided', async () => {
      const spy = vi.fn();
      component.availabilityApplied.subscribe(spy);
      component.availability = [
        { label: '1A', price: 10, currency: 'USD' },
        { label: '99Z', price: 10, currency: 'USD' },
      ];
      mockService.compareWithDecksSeatsInfo.mockReturnValueOnce({
        existingSeatLabels: ['1A'],
        nonExistingSeatLabels: ['99Z'],
      });
      await load();
      expect(spy).toHaveBeenCalledWith({
        existingSeatLabels: ['1A'],
        nonExistingSeatLabels: ['99Z'],
      });
      // Wildcard must be filtered out before passing labels to the comparator.
      expect(mockService.compareWithDecksSeatsInfo).toHaveBeenCalledWith(['1A', '99Z'], component.content);
    });

    it('should NOT emit availabilityApplied after initial load when availability is empty', async () => {
      const spy = vi.fn();
      component.availabilityApplied.subscribe(spy);
      component.availability = undefined;
      await load();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should emit selectAvailableChanged on seat click', async () => {
      await load();
      const spy = vi.fn();
      component.selectAvailableChanged.subscribe(spy);

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─── Touch device behaviour (tooltipOnHover) ──────────────────────────
  //
  // `onSeatMouseEnter` and `onSeatMouseLeave` check `getEnvironmentInfo().isTouchDevice`
  // to decide whether `tooltipOnHover` should open/close the tooltip on hover.
  // On touch devices, hover is suppressed because synthesized hover events are
  // unreliable. Angular's unit-test builder forbids `vi.mock` for relative
  // imports, so we control `isTouchDevice` via the real underlying signals
  // (navigator.maxTouchPoints + HTMLElement.prototype.ontouchstart) and reset
  // the cached result between scenarios.

  describe('Touch device behaviour', () => {
    let savedMaxTouchPointsDescriptor: PropertyDescriptor | undefined;
    let savedOntouchstartDescriptor: PropertyDescriptor | undefined;
    let hadOntouchstart = false;

    async function ready() {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    function applyTouchEnv(isTouchDevice: boolean): void {
      resetCachedEnvironmentInfo();
      Object.defineProperty(navigator, 'maxTouchPoints', {
        configurable: true,
        get: () => (isTouchDevice ? 5 : 0),
      });

      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      if (isTouchDevice) {
        if (!Object.prototype.hasOwnProperty.call(proto, 'ontouchstart')) {
          Object.defineProperty(proto, 'ontouchstart', {
            value: null,
            configurable: true,
            writable: true,
          });
        }
      } else if (Object.prototype.hasOwnProperty.call(proto, 'ontouchstart')) {
        delete proto['ontouchstart'];
      }
    }

    beforeEach(() => {
      savedMaxTouchPointsDescriptor =
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'maxTouchPoints') ??
        Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');

      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      hadOntouchstart = Object.prototype.hasOwnProperty.call(proto, 'ontouchstart');
      savedOntouchstartDescriptor = hadOntouchstart
        ? Object.getOwnPropertyDescriptor(proto, 'ontouchstart')
        : undefined;
    });

    afterEach(() => {
      if (savedMaxTouchPointsDescriptor) {
        Object.defineProperty(navigator, 'maxTouchPoints', savedMaxTouchPointsDescriptor);
      }

      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      const nowHas = Object.prototype.hasOwnProperty.call(proto, 'ontouchstart');
      if (hadOntouchstart && !nowHas && savedOntouchstartDescriptor) {
        Object.defineProperty(proto, 'ontouchstart', savedOntouchstartDescriptor);
      } else if (!hadOntouchstart && nowHas) {
        delete proto['ontouchstart'];
      }

      resetCachedEnvironmentInfo();
    });

    it('suppresses hover-open when tooltipOnHover=true on touch device', async () => {
      applyTouchEnv(true);
      component.config = makeConfig({ tooltipOnHover: true });
      await ready();

      const enterSpy = vi.fn();
      const tooltipSpy = vi.fn();
      component.seatMouseEnter.subscribe(enterSpy);
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });

      expect(enterSpy).toHaveBeenCalledTimes(1);
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(component.activeTooltip).toBeNull();
    });

    it('suppresses hover-close when tooltipOnHover=true on touch device', async () => {
      applyTouchEnv(true);
      component.config = makeConfig({ tooltipOnHover: true });
      await ready();

      // Click path does not consult isTouchDevice — tooltip opens normally.
      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      expect(component.activeTooltip).toBeTruthy();

      const leaveSpy = vi.fn();
      const activeChangedSpy = vi.fn();
      component.seatMouseLeave.subscribe(leaveSpy);
      component.activeTooltipChanged.subscribe(activeChangedSpy);

      component.onSeatMouseLeave({
        seat: makeSeat(),
        element: document.createElement('div'),
      });

      expect(leaveSpy).toHaveBeenCalledTimes(1);
      // Tooltip must remain open and no close emit on touch.
      expect(component.activeTooltip).toBeTruthy();
      expect(activeChangedSpy).not.toHaveBeenCalled();
    });

    it('opens/closes tooltip on hover when tooltipOnHover=true and non-touch', async () => {
      vi.useFakeTimers();
      applyTouchEnv(false);
      component.config = makeConfig({ tooltipOnHover: true });
      await ready();

      const tooltipSpy = vi.fn();
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      expect(tooltipSpy).toHaveBeenCalledTimes(1);
      expect(component.activeTooltip).toBeTruthy();

      const closedSpy = vi.fn();
      component.activeTooltipChanged.subscribe(closedSpy);
      component.onSeatMouseLeave({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      // Close is deferred so the cursor has time to reach the tooltip body.
      expect(component.activeTooltip).toBeTruthy();
      vi.advanceTimersByTime(300);
      expect(component.activeTooltip).toBeNull();
      expect(closedSpy).toHaveBeenCalledWith(null);
      vi.useRealTimers();
    });

    it('hoverable: mouseenter on tooltip cancels pending close', async () => {
      vi.useFakeTimers();
      applyTouchEnv(false);
      component.config = makeConfig({ tooltipOnHover: true });
      await ready();

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      expect(component.activeTooltip).toBeTruthy();

      component.onSeatMouseLeave({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      // Cursor lands on the tooltip before the close timer fires.
      component.onTooltipMouseEnter();
      vi.advanceTimersByTime(200);
      expect(component.activeTooltip).toBeTruthy();
      vi.useRealTimers();
    });

    it('hoverable: mouseleave on tooltip re-arms the deferred close', async () => {
      vi.useFakeTimers();
      applyTouchEnv(false);
      component.config = makeConfig({ tooltipOnHover: true });
      await ready();

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      component.onSeatMouseLeave({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      component.onTooltipMouseEnter();
      expect(component.activeTooltip).toBeTruthy();

      component.onTooltipMouseLeave();
      expect(component.activeTooltip).toBeTruthy();
      vi.advanceTimersByTime(300);
      expect(component.activeTooltip).toBeNull();
      vi.useRealTimers();
    });

    it('hoverable: re-entering a seat aborts a pending close', async () => {
      vi.useFakeTimers();
      applyTouchEnv(false);
      component.config = makeConfig({ tooltipOnHover: true });
      await ready();

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      component.onSeatMouseLeave({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      // Bounce back onto the seat — the pending close must be cancelled,
      // otherwise the new tooltip would be torn down immediately.
      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      vi.advanceTimersByTime(200);
      expect(component.activeTooltip).toBeTruthy();
      vi.useRealTimers();
    });

    it('hoverable: ngOnDestroy clears the pending close timer', async () => {
      vi.useFakeTimers();
      applyTouchEnv(false);
      component.config = makeConfig({ tooltipOnHover: true });
      await ready();

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      component.onSeatMouseLeave({
        seat: makeSeat(),
        element: document.createElement('div'),
      });

      const changedSpy = vi.fn();
      component.activeTooltipChanged.subscribe(changedSpy);
      component.ngOnDestroy();
      vi.advanceTimersByTime(200);
      // No stray activeTooltipChanged(null) emit after teardown.
      expect(changedSpy).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('tooltipOnHover=false on touch device — click still opens, hover does not', async () => {
      applyTouchEnv(true);
      component.config = makeConfig({ tooltipOnHover: false });
      await ready();

      const tooltipSpy = vi.fn();
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      expect(tooltipSpy).not.toHaveBeenCalled();
      expect(component.activeTooltip).toBeNull();

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      expect(tooltipSpy).toHaveBeenCalledTimes(1);
      expect(component.activeTooltip).toBeTruthy();
    });
  });
});
