import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { JetsSeatmapComponent } from './jets-seatmap.component';
import { SeatmapService } from '../../services/seatmap.service';
import {
  IConfig,
  IDeckData,
  IFlight,
  IPassenger,
  ISeatData,
  ISeatMapInitedEvent,
  TSeatAvailability,
} from '../../types';
import { SEAT_STATUS_MAP, SEAT_TYPE_MAP } from '../../constants';

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
    type: SEAT_TYPE_MAP.seat,
    status: SEAT_STATUS_MAP.available,
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
    type: SEAT_TYPE_MAP.aisle,
    status: SEAT_STATUS_MAP.unavailable,
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

// ─── Mock SeatmapService ────────────────────────────────────────────────────

function createMockSeatmapService(content: IDeckData[] = [makeDeckData()]) {
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

describe('JetsSeatmapComponent', () => {
  let fixture: ComponentFixture<JetsSeatmapComponent>;
  let component: JetsSeatmapComponent;
  let mockService: ReturnType<typeof createMockSeatmapService>;

  beforeEach(async () => {
    mockService = createMockSeatmapService();

    await TestBed.configureTestingModule({
      imports: [JetsSeatmapComponent, HttpClientTestingModule],
      providers: [{ provide: SeatmapService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsSeatmapComponent);
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
        colorTheme: { seatmapBackgroundColor: '#FF0000' },
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
});
