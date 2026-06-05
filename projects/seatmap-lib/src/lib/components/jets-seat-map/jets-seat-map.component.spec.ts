import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
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
      const availableSeats = [makeSeat()];
      mockService.collectAvailableSeats.mockReturnValue(availableSeats);

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

      expect(spy).toHaveBeenCalledWith({ seat, element: el });
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

    it('should emit seatMouseLeave', () => {
      const spy = vi.fn();
      component.seatMouseLeave.subscribe(spy);

      const event = { seat: makeSeat(), element: document.createElement('div') };
      component.onSeatMouseLeave(event);
      expect(spy).toHaveBeenCalledWith(event);
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

  // ─── Tooltip focus return (commit 11 / WCAG 2.4.3) ────────────────────
  describe('Tooltip focus return', () => {
    it('_showTooltip records the trigger element as _lastTriggerElement', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const trigger = document.createElement('div');
      component.onSeatClick({ seat: makeSeat(), element: trigger });

      // Field is private; cast to any in the test only.
      expect((component as any)._lastTriggerElement).toBe(trigger);
    });

    it('onTooltipClose schedules a focus restoration on the stored trigger', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Use a real button so .focus() actually works in jsdom.
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      const focusSpy = vi.spyOn(trigger, 'focus');

      vi.useFakeTimers();
      try {
        component.onSeatClick({ seat: makeSeat(), element: trigger });
        component.onTooltipClose();
        // Restoration is deferred via setTimeout(0) so the tooltip DOM has
        // time to detach before focus moves.
        expect(focusSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(10);
        expect(focusSpy).toHaveBeenCalledTimes(1);
        // After restoration, the stored reference is cleared.
        expect((component as any)._lastTriggerElement).toBeNull();
      } finally {
        vi.useRealTimers();
        document.body.removeChild(trigger);
      }
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
      expect(clickSpy.mock.calls[0][0]).toMatchObject({ seat, element, event: evt });
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

    it('should emit seatMapInited as IInitialLayoutData with extended fields', async () => {
      const allSeats = [makeSeat()];
      mockService.collectAllSeats.mockReturnValue(allSeats);
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
        allSeats,
        availableCabins: [{ code: 'E', title: 'Economy' }],
      });
      expect(typeof payload.heightInPx).toBe('number');
      expect(typeof payload.widthInPx).toBe('number');
      expect(typeof payload.scaleFactor).toBe('number');
      expect(payload.media).toEqual({ photoData: [] });
      expect(payload.error).toBeUndefined();
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
      vi.useFakeTimers();
      try {
        component.onSeatMouseLeave({
          seat: makeSeat(),
          element: document.createElement('div'),
        });
        // SC 1.4.13: close is deferred so the cursor can land on the tooltip.
        expect(component.activeTooltip).toBeTruthy();
        vi.advanceTimersByTime(100);
      } finally {
        vi.useRealTimers();
      }
      expect(component.activeTooltip).toBeNull();
      expect(closedSpy).toHaveBeenCalledWith(null);
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

  // ─── LiveAnnouncer (WCAG 4.1.3 status messages, commit 9) ─────────────
  //
  // Verifies that the polite live region fires the expected English string
  // for each of the three a11y events: select, unselect, jump. Restriction
  // announcements are intentionally NOT covered here — commit 10 owns the
  // restriction-reasoning hook in the tooltip and will route through this
  // same LiveAnnouncer once the hook exists.
  describe('LiveAnnouncer (a11y)', () => {
    let announceSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      announceSpy = vi.fn().mockResolvedValue(undefined);

      // Replace CDK's root LiveAnnouncer with a mock so we don't depend on
      // jsdom DOM-region behaviour and can assert exact message strings.
      // Build a fresh TestBed for this describe block — the outer beforeEach
      // already configured one without the LiveAnnouncer override.
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [JetsSeatMapComponent, HttpClientTestingModule],
        providers: [
          { provide: JetsSeatMapService, useValue: mockService },
          { provide: LiveAnnouncer, useValue: { announce: announceSpy, clear: vi.fn() } },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(JetsSeatMapComponent);
      component = fixture.componentInstance;
      component.flight = makeFlight();
      component.config = makeConfig();

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('announces select with passenger label and price (polite)', () => {
      const passenger: IPassenger = { id: 'p1', passengerLabel: 'John Doe' };
      mockService.getNextPassenger.mockReturnValue(passenger);
      mockService.selectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: [passenger],
      });

      component.onTooltipSelect(
        makeSeat({ number: '14C', price: 12, currency: '€' })
      );

      expect(announceSpy).toHaveBeenCalledWith(
        'Seat 14C selected for John Doe, €12',
        'polite'
      );
    });

    it('falls back to passenger.abbr when passengerLabel is missing', () => {
      const passenger: IPassenger = { id: 'p1', abbr: 'JD' };
      mockService.getNextPassenger.mockReturnValue(passenger);
      mockService.selectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: [passenger],
      });

      component.onTooltipSelect(
        makeSeat({ number: '14C', price: 12, currency: '€' })
      );

      expect(announceSpy).toHaveBeenCalledWith(
        'Seat 14C selected for JD, €12',
        'polite'
      );
    });

    it('falls back to "passenger" when neither label nor abbr is set', () => {
      mockService.getNextPassenger.mockReturnValue(null);
      mockService.selectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: [],
      });

      component.onTooltipSelect(
        makeSeat({ number: '14C', price: 12, currency: '€' })
      );

      expect(announceSpy).toHaveBeenCalledWith(
        'Seat 14C selected for passenger, €12',
        'polite'
      );
    });

    it('announces unselect with the seat number (polite)', () => {
      mockService.unselectSeatHandler.mockReturnValue({
        data: [makeDeckData()],
        passengers: [],
      });

      component.onTooltipUnselect(makeSeat({ number: '14C' }));

      expect(announceSpy).toHaveBeenCalledWith('Seat 14C cleared', 'polite');
    });

    it('announces jump-to-seat once the seat is located in the DOM', async () => {
      // The seat 1A is in the default mock deck data.
      const triggerEl = document.createElement('div');
      triggerEl.setAttribute('data-seat-number', '1A');
      // Stub mapContainer.querySelector to find our element regardless of
      // whether the deck rendered in jsdom layout.
      Object.defineProperty(component, 'mapContainer', {
        value: {
          nativeElement: {
            querySelector: (sel: string) =>
              sel.includes('1A') ? triggerEl : null,
          },
        },
        configurable: true,
      });

      vi.useFakeTimers();
      try {
        (component as any)._jumpToSeat('1A');
        // _jumpToSeat schedules a 150ms timeout before locating the element
        // and emitting the announcement.
        vi.advanceTimersByTime(160);
      } finally {
        vi.useRealTimers();
      }

      expect(announceSpy).toHaveBeenCalledWith('Move to seat 1A', 'polite');
    });

    it('announces "not found" when the seat label has no match', () => {
      (component as any)._jumpToSeat('99Z');
      expect(announceSpy).toHaveBeenCalledWith('Seat 99Z not found', 'polite');
    });
  });

  // ─── Grid keyboard nav integration (commit 7) ──────────────────────────

  describe('Grid keyboard navigation (commit 7)', () => {
    beforeEach(() => {
      component.content = [
        {
          rows: [
            { id: 'r1', name: '1', seats: [
              makeSeat({ id: 's-1a', number: '1A', letter: 'A' }),
              makeSeat({ id: 's-1b', number: '1B', letter: 'B' }),
              makeSeat({ id: 's-1c', number: '1C', letter: 'C' }),
            ]},
            { id: 'r2', name: '2', seats: [
              makeSeat({ id: 's-2a', number: '2A', letter: 'A' }),
              makeSeat({ id: 's-2b', number: '2B', letter: 'B' }),
              makeSeat({ id: 's-2c', number: '2C', letter: 'C' }),
            ]},
          ],
          number: 1,
          scale: 1,
        },
      ];
      component.focusedCell = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      // Stub mapContainer so the imperative DOM walk (`_applyRovingTabindex`,
      // `_focusCell`) doesn't throw on a missing native element.
      Object.defineProperty(component, 'mapContainer', {
        value: { nativeElement: { querySelector: () => null, querySelectorAll: () => [] } },
        configurable: true,
      });
    });

    it('ArrowRight advances colIdx and prevents default', () => {
      const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      const preventSpy = vi.spyOn(ev, 'preventDefault');
      component.onGridKeydown(ev);
      expect(component.focusedCell).toMatchObject({ deckIdx: 0, rowIdx: 0, colIdx: 1 });
      expect(preventSpy).toHaveBeenCalled();
    });

    it('ArrowDown advances rowIdx', () => {
      component.onGridKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(component.focusedCell).toMatchObject({ deckIdx: 0, rowIdx: 1, colIdx: 0 });
    });

    it('Home jumps to first column of current row', () => {
      component.focusedCell = { deckIdx: 0, rowIdx: 1, colIdx: 2 };
      component.onGridKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
      expect(component.focusedCell.colIdx).toBe(0);
    });

    it('Ctrl+End jumps to last cell of the deck', () => {
      component.onGridKeydown(new KeyboardEvent('keydown', { key: 'End', ctrlKey: true }));
      expect(component.focusedCell).toMatchObject({ rowIdx: 1, colIdx: 2 });
    });

    it('Escape with an open tooltip closes it (does not move focus)', () => {
      component.activeTooltip = { seat: makeSeat(), top: 0, left: 0, nextPassenger: null, lang: 'EN' } as any;
      const closeSpy = vi.spyOn(component, 'onTooltipClose');
      component.onGridKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closeSpy).toHaveBeenCalled();
    });

    it('ignores unrelated keys (typing letters does not move focus)', () => {
      const ev = new KeyboardEvent('keydown', { key: 'a' });
      const preventSpy = vi.spyOn(ev, 'preventDefault');
      component.onGridKeydown(ev);
      expect(component.focusedCell).toMatchObject({ deckIdx: 0, rowIdx: 0, colIdx: 0 });
      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('focusin on a gridcell with aria-rowindex/colindex updates focusedCell', () => {
      const el = document.createElement('button');
      el.setAttribute('aria-rowindex', '2');
      el.setAttribute('aria-colindex', '3');
      const ev = { target: el } as unknown as FocusEvent;
      component.onGridFocusin(ev);
      expect(component.focusedCell).toMatchObject({ rowIdx: 1, colIdx: 2 });
    });
  });

  // ─── Hover tooltip — focus-aware + hoverable (commit 8 / SC 1.4.13) ────
  //
  // Covers the three behaviour changes layered on top of the existing
  // hover-tooltip path: (a) focusin opens the tooltip when tooltipOnHover
  // is on, (b) onSeatMouseLeave defers the close so the cursor can land on
  // the tooltip, (c) tooltip mouseenter/mouseleave cancel/re-arm the close.
  describe('Hover tooltip a11y (commit 8)', () => {
    let savedDescriptor: PropertyDescriptor | undefined;
    let hadOntouchstart = false;

    beforeEach(() => {
      // Force non-touch — the hover/focus paths short-circuit on touch.
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

      // Minimal in-memory content the focusin handler can resolve a seat from.
      component.content = [
        {
          rows: [
            {
              id: 'r1',
              seats: [
                makeSeat({ id: 's-1a', number: '1A', letter: 'A' }),
                makeSeat({ id: 's-1b', number: '1B', letter: 'B' }),
              ],
            },
          ],
          number: 1,
          scale: 1,
        },
      ];
      component.focusedCell = { deckIdx: 0, rowIdx: 0, colIdx: 0 };
      Object.defineProperty(component, 'mapContainer', {
        value: { nativeElement: { querySelector: () => null, querySelectorAll: () => [] } },
        configurable: true,
      });
    });

    afterEach(() => {
      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      if (hadOntouchstart && savedDescriptor) {
        Object.defineProperty(proto, 'ontouchstart', savedDescriptor);
      }
      resetCachedEnvironmentInfo();
    });

    function makeGridcellFocusEvent(rowIdx = 1, colIdx = 1): FocusEvent {
      const el = document.createElement('button');
      el.setAttribute('aria-rowindex', String(rowIdx));
      el.setAttribute('aria-colindex', String(colIdx));
      return { target: el } as unknown as FocusEvent;
    }

    it('onGridFocusin opens the tooltip when tooltipOnHover=true and the cell is an available seat', () => {
      component.config = makeConfig({ tooltipOnHover: true });
      const tooltipSpy = vi.fn();
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onGridFocusin(makeGridcellFocusEvent(1, 1));

      expect(component.activeTooltip).toBeTruthy();
      expect(tooltipSpy).toHaveBeenCalledTimes(1);
    });

    it('onGridFocusin does NOT open the tooltip when tooltipOnHover is off', () => {
      component.config = makeConfig({ tooltipOnHover: false });
      const tooltipSpy = vi.fn();
      component.tooltipRequested.subscribe(tooltipSpy);

      component.onGridFocusin(makeGridcellFocusEvent(1, 1));

      expect(component.activeTooltip).toBeNull();
      expect(tooltipSpy).not.toHaveBeenCalled();
    });

    it('onSeatMouseLeave defers the close by ~80ms (SC 1.4.13 hoverable)', () => {
      component.config = makeConfig({ tooltipOnHover: true });
      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });
      expect(component.activeTooltip).toBeTruthy();

      vi.useFakeTimers();
      try {
        component.onSeatMouseLeave({
          seat: makeSeat(),
          element: document.createElement('div'),
        });
        // Tooltip must still be open immediately after mouseleave.
        expect(component.activeTooltip).toBeTruthy();
        vi.advanceTimersByTime(79);
        expect(component.activeTooltip).toBeTruthy();
        vi.advanceTimersByTime(2);
        expect(component.activeTooltip).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('onTooltipMouseEnter cancels a pending close timer', () => {
      component.config = makeConfig({ tooltipOnHover: true });
      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });

      vi.useFakeTimers();
      try {
        component.onSeatMouseLeave({
          seat: makeSeat(),
          element: document.createElement('div'),
        });
        // Cursor moves into the tooltip — cancel the pending close.
        component.onTooltipMouseEnter();
        vi.advanceTimersByTime(500);
        // Tooltip should still be open because the timer was cancelled.
        expect(component.activeTooltip).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('onTooltipMouseLeave re-schedules the deferred close', () => {
      component.config = makeConfig({ tooltipOnHover: true });
      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });

      vi.useFakeTimers();
      try {
        // Simulate cursor entering and then leaving the tooltip body.
        component.onTooltipMouseEnter();
        component.onTooltipMouseLeave();
        expect(component.activeTooltip).toBeTruthy();
        vi.advanceTimersByTime(100);
        expect(component.activeTooltip).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('ngOnDestroy clears a pending hover-close timer', () => {
      component.config = makeConfig({ tooltipOnHover: true });
      component.onSeatMouseEnter({
        seat: makeSeat(),
        element: document.createElement('div'),
      });

      vi.useFakeTimers();
      try {
        component.onSeatMouseLeave({
          seat: makeSeat(),
          element: document.createElement('div'),
        });
        const closedSpy = vi.fn();
        component.activeTooltipChanged.subscribe(closedSpy);
        component.ngOnDestroy();
        vi.advanceTimersByTime(500);
        // The timer must have been cleared — no stray emit after destroy.
        expect(closedSpy).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
