import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  JetsSeatMapComponent,
  IPassenger,
  IInitialLayoutData,
  ILayoutData,
  IConfig,
  IExistingSeatsLabelsInfo,
  IFlight,
  ISeatMouseClickData,
  ISeatMouseLeaveData,
  ITooltipRequestData,
  TSeatAvailability,
} from '@kwiket/jets-seatmap-angular-lib';
import { DemoFlight } from './flights.data';
import { FlightsService } from './flights.service';

interface EventLogEntry {
  id: number;
  type: string;
  message: string;
  time: string;
}

interface ControlDef {
  label: string;
  key: string;
}

const CONTROLS: ControlDef[] = [
  { label: 'INIT SEAT MAP', key: 'config' },
  { label: 'SET FLIGHT', key: 'flight' },
  { label: 'SET AVAILABILITY', key: 'availability' },
  { label: 'SET PASSENGERS', key: 'passengers' },
  { label: 'SET DECK', key: 'deck' },
  { label: 'SEAT JUMP TO', key: 'seatJumpTo' },
];

const DEFAULT_AVAILABILITY = [
  {
    currency: 'USD',
    label: '20A',
    price: 33,
    onlyForPassengerType: ['ADT', 'CHD', 'INF'],
    additionalProps: [
      { label: 'Test prop for all', icon: null },
      { label: 'Another test prop for all', icon: 'wifi' },
    ],
    color: 'green',
  },
  {
    currency: 'USD',
    label: '20E',
    price: 33,
    onlyForPassengerType: ['ADT', 'CHD', 'INF'],
    additionalProps: [
      { label: 'Clear air', icon: null, cssClass: 'clear-air-style' },
      { label: 'USB plug', icon: 'power' },
    ],
    color: 'red',
  },
  {
    currency: 'USD',
    label: '20K',
    price: 33,
    onlyForPassengerType: ['ADT', 'CHD', 'INF'],
    color: 'magenta',
  },
  {
    currency: 'USD',
    label: '21F',
    price: 13,
    onlyForPassengerType: ['ADT', 'CHD', 'INF'],
  },
  {
    currency: 'USD',
    label: '21J',
    price: 13,
    onlyForPassengerType: ['CHD', 'INF'],
  },
  {
    currency: 'USD',
    label: '35K',
    price: 137,
    onlyForPassengerType: ['CHD', 'INF'],
  },
  {
    currency: 'EUR',
    label: '70E',
    price: 133399,
  },
];

const DEFAULT_PASSENGERS: IPassenger[] = [
  { passengerType: 'ADT', id: '1', seat: null as any },
  { passengerType: 'CHD', id: '2', seat: null as any },
];

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, JetsSeatMapComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly flightsService = inject(FlightsService);
  readonly flights = this.flightsService.flights;
  readonly controls = CONTROLS;

  selectedIndex = signal(0);
  eventLog = signal<EventLogEntry[]>([]);
  private nextLogId = 0;
  sidePanelEnabled = signal(false);
  sidePanelSide = signal<'left' | 'right'>('left');

  // Override signals
  configOverride = signal<IConfig | null>(null);
  flightOverride = signal<IFlight | null>(null);
  availabilityOverride = signal<TSeatAvailability | undefined>(undefined);
  passengersOverride = signal<IPassenger[] | undefined>(undefined);
  deckIndexOverride = signal(0);
  seatJumpToOverride = signal<{ seatLabel: string } | undefined>(undefined);

  // Textarea content signals
  textareas = signal<Record<string, string>>({});

  // Computed active config/flight with overrides applied
  activeConfig = computed<IConfig>(() => {
    const base = this.flights[this.selectedIndex()].config;
    const override = this.configOverride();
    const merged = override ? { ...base, ...override } : { ...base };
    return merged;
  });

  activeFlight = computed<IFlight>(() => {
    const base = this.flights[this.selectedIndex()].flight;
    const override = this.flightOverride();
    return override ? { ...base, ...override } : base;
  });

  activeAvailability = computed<TSeatAvailability | undefined>(() => {
    const override = this.availabilityOverride();
    return override !== undefined ? override : this.flights[this.selectedIndex()].availability;
  });

  activePassengers = computed<IPassenger[] | undefined>(() => {
    const override = this.passengersOverride();
    return override !== undefined ? override : this.flights[this.selectedIndex()].passengers;
  });

  constructor() {
    // Update textareas when flight selection changes
    effect(() => {
      const flight = this.flights[this.selectedIndex()];
      this.updateTextareasForFlight(flight);
    });
  }

  private updateTextareasForFlight(flight: DemoFlight): void {
    const { config, availability, passengers, ...rest } = flight;
    const { apiUrl, apiAppId, apiKey, colorTheme, ...displayConfig } = config;
    this.textareas.set({
      config: JSON.stringify(displayConfig, null, 2),
      flight: JSON.stringify(flight.flight, null, 2),
      availability: JSON.stringify(DEFAULT_AVAILABILITY, null, 2),
      passengers: JSON.stringify(DEFAULT_PASSENGERS, null, 2),
      deck: '0',
      seatJumpTo: '41A',
    });
  }

  getTextarea(key: string): string {
    return this.textareas()[key] || '';
  }

  setTextarea(key: string, value: string): void {
    this.textareas.update(t => ({ ...t, [key]: value }));
  }

  selectFlight(index: number): void {
    this.selectedIndex.set(index);
    this.configOverride.set(null);
    this.flightOverride.set(null);
    this.availabilityOverride.set(undefined);
    this.passengersOverride.set(undefined);
    this.deckIndexOverride.set(0);
    this.seatJumpToOverride.set(undefined);
    this.eventLog.set([]);
  }

  applyControl(key: string): void {
    const raw = this.getTextarea(key);
    try {
      switch (key) {
        case 'config': {
          const parsed = JSON.parse(raw);
          this.configOverride.set(parsed);
          this.addLog('control', `Config updated`);
          break;
        }
        case 'flight': {
          const parsed = JSON.parse(raw);
          this.flightOverride.set(parsed);
          this.addLog('control', `Flight updated`);
          break;
        }
        case 'availability': {
          const parsed = JSON.parse(raw);
          this.availabilityOverride.set(parsed);
          this.addLog('control', `Availability updated`);
          break;
        }
        case 'passengers': {
          const parsed = JSON.parse(raw);
          this.passengersOverride.set(parsed);
          this.addLog('control', `Passengers updated`);
          break;
        }
        case 'deck': {
          const val = parseInt(raw.trim(), 10);
          if (isNaN(val)) throw new Error('Invalid number');
          this.deckIndexOverride.set(val);
          this.addLog('control', `Deck index set to ${val}`);
          break;
        }
        case 'seatJumpTo': {
          const seatLabel = raw.trim();
          if (!seatLabel) throw new Error('Seat label is empty');
          // Toggle through undefined so that reassigning the same label still triggers a jump.
          this.seatJumpToOverride.set(undefined);
          setTimeout(() => {
            this.seatJumpToOverride.set({ seatLabel });
          });
          this.addLog('control', `Seat jump to ${seatLabel}`);
          break;
        }
      }
    } catch (e: any) {
      this.addLog('error', `Invalid input: ${e.message}`);
    }
  }

  onSeatMapInited(event: IInitialLayoutData): void {
    console.log('InitialLayoutData:', event);
    // Test seam — mirrors `__lastTooltipRequest`; lets e2e suites assert the
    // public contract of the init payload without subscribing inside Playwright.
    if (typeof window !== 'undefined') {
      (window as Window & { __lastSeatMapInited?: unknown }).__lastSeatMapInited = event;
    }
    if (event.error) {
      this.addLog('error', `Seatmap init failed: ${event.error}`);
      return;
    }
    this.addLog(
      'inited',
      `Seatmap loaded. Cabins: ${event.allCabins?.length ?? 0}, decks: ${event.decksCount}, ` +
        `native ${event.heightInPx?.toFixed(0)}×${event.widthInPx?.toFixed(0)}, scale ${event.scaleFactor?.toFixed(3)}`
    );
  }

  onLayoutUpdated(event: ILayoutData): void {
    console.log('Layout updated:', event);
    this.addLog(
      'layout',
      `Layout updated — deck ${event.currentDeckIndex + 1}/${event.decksCount}, ` +
        `${event.heightInPx.toFixed(0)}×${event.widthInPx.toFixed(0)}, scale ${event.scaleFactor.toFixed(3)}`
    );
  }

  onSeatSelected(passengers: IPassenger[]): void {
    const seated = passengers.filter(p => p.seat);
    const names = seated.map(p => `${p.passengerLabel || p.id} → ${p.seat?.seatLabel}`).join(', ');
    this.addLog('selected', `Selected: ${names}`);
  }

  onSeatUnselected(passengers: IPassenger[]): void {
    this.addLog('unselected', 'Seat unselected');
  }

  onSeatMouseLeave(data: ISeatMouseLeaveData): void {
    console.log('Seat mouse leave: ', data);
    this.addLog('mouseLeave', `Mouse leave seat ${data.seat?.number ?? '?'}`);
  }

  onSeatMouseClick(data: ISeatMouseClickData): void {
    console.log('Seat mouse click: ', data);
    this.addLog('mouseClick', `Mouse click seat ${data.seat?.number ?? '?'}`);
  }

  onAvailabilityApplied(data: IExistingSeatsLabelsInfo): void {
    console.log('Availability applied: ', data);
    this.addLog(
      'availability',
      `Availability applied. Existing: ${data.existingSeatLabels.length}, missing: ${data.nonExistingSeatLabels.length}`
    );
  }

  /**
   * Exposes the latest `tooltipRequested` payload on `window.__lastTooltipRequest`
   * so the e2e suite can introspect the data the lib hands to integrators when
   * they want to render a custom tooltip. The actual demo never builds its own
   * tooltip — this hook exists solely as a test seam.
   */
  onTooltipRequested(data: ITooltipRequestData): void {
    console.log('Tooltip requested: ', data);
    if (typeof window !== 'undefined') {
      (window as Window & { __lastTooltipRequest?: unknown }).__lastTooltipRequest = data;
    }
    this.addLog('tooltip', `Tooltip requested for seat ${data.seat?.number ?? '?'}`);
  }

  onLoadError(message: string): void {
    this.addLog('error', `API Error: ${message}`);
  }

  private addLog(type: string, message: string): void {
    const entry: EventLogEntry = {
      id: this.nextLogId++,
      type,
      message,
      time: new Date().toLocaleTimeString(),
    };
    this.eventLog.update(log => [entry, ...log].slice(0, 20));
  }
}
