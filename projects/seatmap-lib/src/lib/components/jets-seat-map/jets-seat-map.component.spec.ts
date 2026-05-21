import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { JetsSeatMapComponent } from './jets-seat-map.component';
import { JetsSeatMapService } from '../../services/jets-seat-map.service';
import {
  IConfig,
  IDeckData,
  IFlight,
  IPassenger,
  ISeatData,
  IInitialLayoutData,
  TSeatAvailability,
} from '../../types';
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
        expect.anything(),
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

    it('should apply RTL direction when config.rightToLeft is true', () => {
      component.config = makeConfig({ rightToLeft: true });
      fixture.detectChanges();

      expect(component.mapDirection).toBe('rtl');
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
        }),
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
      let resolveFirst: (v: {
        content: IDeckData[];
        media: null;
        availableCabins: never[];
      }) => void;
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

  describe('seatMouseClick (external management + hover tooltip mode)', () => {
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

    it('should emit selectAvailableChanged on seat click', async () => {
      await load();
      const spy = vi.fn();
      component.selectAvailableChanged.subscribe(spy);

      component.onSeatClick({ seat: makeSeat(), element: document.createElement('div') });
      expect(spy).toHaveBeenCalled();
    });
  });
});
