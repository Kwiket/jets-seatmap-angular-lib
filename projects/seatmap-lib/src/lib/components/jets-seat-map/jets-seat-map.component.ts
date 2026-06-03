import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  Type,
  ViewChild,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import {
  IConfig,
  IDeckData,
  IExistingSeatsLabelsInfo,
  IFlight,
  IInitialLayoutData,
  ILayoutData,
  ILegendItem,
  IMediaData,
  IPassenger,
  ISeatData,
  ISeatMouseClickData,
  ISeatMouseEnterData,
  ISeatMouseLeaveData,
  ITooltipData,
  ITooltipRequestData,
  IWingsInfo,
  TSeatAvailability,
} from '../../types';
import {
  DEFAULT_COLOR_THEME,
  DEFAULT_LANG,
  DEFAULT_SEAT_MAP_WIDTH,
  DEFAULT_UNITS,
  LOCALES_MAP,
  SCALE_TYPES,
} from '../../constants';
import { getNativeRowHeight } from '../../utils/cabin-utils';
import { getEnvironmentInfo } from '../../services/environment.service';
import { JetsSeatMapService } from '../../services/jets-seat-map.service';
import { JetsDeckComponent } from '../jets-deck/jets-deck.component';
import { JetsTooltipComponent } from '../jets-tooltip/jets-tooltip.component';
import { JetsNotInitComponent } from '../jets-not-init/jets-not-init.component';
import { JetsNoDataComponent } from '../jets-no-data/jets-no-data.component';
import { JetsPlaneBodyComponent } from '../jets-plane-body/jets-plane-body.component';
import { JetsDeckSelectorComponent } from '../jets-deck-selector/jets-deck-selector.component';
import { JetsDeckSeparatorComponent } from '../jets-deck-separator/jets-deck-separator.component';
import { JetsWingComponent } from '../jets-wing/jets-wing.component';

@Component({
  selector: 'sm-jets-seat-map',
  standalone: true,
  imports: [
    CommonModule,
    NgComponentOutlet,
    JetsDeckComponent,
    JetsTooltipComponent,
    JetsNotInitComponent,
    JetsNoDataComponent,
    JetsPlaneBodyComponent,
    JetsDeckSelectorComponent,
    JetsDeckSeparatorComponent,
    JetsWingComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jets-seat-map.component.html',
  styleUrls: ['./jets-seat-map.component.scss'],
})
export class JetsSeatMapComponent implements OnInit, OnChanges, OnDestroy {
  @Input() flight!: IFlight;
  @Input() config!: IConfig;
  @Input() availability?: TSeatAvailability;
  @Input() passengers?: IPassenger[];
  @Input() currentDeckIndex = 0;
  /**
   * Scroll to a specific seat and open its tooltip. Matches React's seatJumpTo prop.
   * Reassigning the same value will not re-trigger the jump.
   */
  @Input() seatJumpTo?: { seatLabel: string };

  @Output() seatMapInited = new EventEmitter<IInitialLayoutData>();
  @Output() seatSelected = new EventEmitter<IPassenger[]>();
  @Output() seatUnselected = new EventEmitter<IPassenger[]>();
  @Output() tooltipRequested = new EventEmitter<ITooltipRequestData>();
  @Output() layoutUpdated = new EventEmitter<ILayoutData>();
  @Output() availabilityApplied = new EventEmitter<IExistingSeatsLabelsInfo>();
  @Output() deckChanged = new EventEmitter<number>();
  @Output() loadError = new EventEmitter<string>();
  @Output() seatMouseEnter = new EventEmitter<ISeatMouseEnterData>();
  @Output() seatMouseLeave = new EventEmitter<ISeatMouseLeaveData>();
  /**
   * Fired when a seat is clicked while `externalPassengerManagement` and
   * `tooltipOnHover` are both enabled. Matches React's onSeatMouseClick.
   */
  @Output() seatMouseClick = new EventEmitter<ISeatMouseClickData>();
  @Output() activeTooltipChanged = new EventEmitter<ITooltipData | null>();
  @Output() legendReady = new EventEmitter<ILegendItem[]>();
  @Output() mediaReady = new EventEmitter<IMediaData | null>();
  @Output() passengersChanged = new EventEmitter<IPassenger[]>();
  @Output() selectAvailableChanged = new EventEmitter<boolean>();
  @Output() currencyDetected = new EventEmitter<string>();
  @Output() hasAvailabilityChanged = new EventEmitter<boolean>();

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;

  content: IDeckData[] = [];
  media: IMediaData | null = null;
  isSeatMapInited = false;
  isLoading = false;
  error: string | null = null;
  activeTooltip: ITooltipData | null = null;
  passengersList: IPassenger[] = [];
  isSelectAvailable = false;
  activeDeckIndex = 0;

  private _flightId: string | null = null;
  private _prevLang: string | null = null;
  private _prevUnits: string | null = null;
  private _prevSeatJumpToLabel: string | null = null;

  constructor(
    private seatmapService: JetsSeatMapService,
    private cdr: ChangeDetectorRef
  ) {}

  get resolvedConfig(): IConfig {
    const env = getEnvironmentInfo();
    // Firefox doesn't fully support CSS zoom — force SCALE mode
    let scaleType = this.config?.scaleType;
    if (env.isFirefox && scaleType === SCALE_TYPES.ZOOM) {
      scaleType = SCALE_TYPES.SCALE as any;
    }
    return {
      ...this.config,
      width: this.config?.width ?? DEFAULT_SEAT_MAP_WIDTH,
      lang: this.config?.lang ?? (DEFAULT_LANG as any),
      units: this.config?.units ?? (DEFAULT_UNITS as any),
      builtInTooltip: this.config?.builtInTooltip ?? true,
      builtInDeckSelector: this.config?.builtInDeckSelector ?? true,
      singleDeckMode: this.config?.singleDeckMode ?? true,
      visibleFuselage: this.config?.visibleFuselage ?? true,
      visibleSeatPriceLabels: this.config?.visibleSeatPriceLabels ?? false,
      flatBulks: this.config?.flatBulks ?? false,
      colorfulSeatsByClass: this.config?.colorfulSeatsByClass ?? false,
      colorfulSeatsByScore: this.config?.colorfulSeatsByScore ?? true,
      scaleType,
    };
  }

  /** CSS transform for horizontal layout mode */
  get mapTransform(): string {
    const cfg = this.resolvedConfig;
    if (!cfg.horizontal) return '';
    const scaleType = cfg.scaleType ?? SCALE_TYPES.SCALE;
    const offset = scaleType === SCALE_TYPES.ZOOM ? 'translateY(-100%)' : 'translateY(-100%)';
    return `rotate(90deg) ${offset}`;
  }

  /** CSS transform-origin for horizontal layout */
  get mapTransformOrigin(): string {
    return this.resolvedConfig.horizontal ? 'top left' : '';
  }

  get lang(): string {
    return this.resolvedConfig.lang || DEFAULT_LANG;
  }

  get showDeckNumbers(): boolean {
    return this.content.length > 1;
  }

  get showDeckSelector(): boolean {
    return this.resolvedConfig.builtInDeckSelector !== false && this.content.length > 1;
  }

  get showFuselage(): boolean {
    return this.resolvedConfig.visibleFuselage !== false;
  }

  get currencySign(): string {
    if (this.resolvedConfig.currencySign) return this.resolvedConfig.currencySign;
    for (const deck of this.content) {
      for (const row of deck.rows) {
        for (const seat of row.seats) {
          if (seat.currency) return seat.currency;
        }
      }
    }
    return '';
  }

  get hasAvailability(): boolean {
    return !!this.availability?.length;
  }

  get legendItems(): ILegendItem[] {
    // Hide legend when availability is not provided (turned off)
    if (!this.availability?.length) return [];

    const theme = this.resolvedConfig.colorTheme ?? {};
    const locale = LOCALES_MAP[this.lang] || LOCALES_MAP['EN'];
    const items: ILegendItem[] = [];

    // Collect unique prices from availability
    const seenPrices = new Set<number>();
    for (const deck of this.content) {
      for (const row of deck.rows) {
        for (const seat of row.seats) {
          if (seat.type !== 'seat') continue;
          if (seat.status === 'available' && seat.price != null && !seenPrices.has(seat.price)) {
            seenPrices.add(seat.price);
            if (seat.price === 0) {
              const freeColor = seat.color || theme.seatAvailableColor || DEFAULT_COLOR_THEME.seatAvailableColor;
              items.push({
                label: `${locale['available']} (${locale['free'] || 'free'})`,
                color: freeColor,
                borderColor: freeColor === '#ffffff' || freeColor === '#fff' ? '#cccccc' : undefined,
              });
            } else {
              const currency = seat.currency || '';
              items.push({
                label: `${currency} ${seat.price}`,
                color: seat.color || theme.seatAvailableColor || DEFAULT_COLOR_THEME.seatAvailableColor,
              });
            }
          }
        }
      }
    }

    // If no priced seats found but there are available seats, add a generic available item
    if (items.length === 0) {
      const hasAvailable = this.content.some(d =>
        d.rows.some(r => r.seats.some(s => s.type === 'seat' && s.status === 'available'))
      );
      if (hasAvailable) {
        items.push({
          label: locale['available'],
          color: theme.seatAvailableColor || DEFAULT_COLOR_THEME.seatAvailableColor,
        });
      }
    }

    // Unavailable
    items.push({
      label: locale['unavailable'],
      color: theme.seatUnavailableColor || DEFAULT_COLOR_THEME.seatUnavailableColor,
      icon: 'cross',
    });

    // Selected
    items.push({
      label: locale['selected'],
      color: theme.seatSelectedColor || DEFAULT_COLOR_THEME.seatSelectedColor,
      icon: 'checkmark',
    });

    return items;
  }

  get visibleDecks(): IDeckData[] {
    if (this.resolvedConfig.singleDeckMode && this.content.length > 1) {
      return [this.content[this.activeDeckIndex]].filter(Boolean);
    }
    return this.content;
  }

  get noseType(): string {
    return this.content[0]?.extras?.noseType ?? 'default';
  }

  // ─── Component overrides (React-parity API) ──────────────────────────────
  get tooltipOverride(): Type<unknown> | null {
    return this.resolvedConfig.componentOverrides?.JetsTooltip ?? null;
  }

  get tooltipViewOverride(): Type<unknown> | null {
    return this.resolvedConfig.componentOverrides?.JetsTooltipView ?? null;
  }

  get notInitOverride(): Type<unknown> | null {
    return this.resolvedConfig.componentOverrides?.JetsNotInit ?? null;
  }

  get seatOverride(): Type<unknown> | null {
    return this.resolvedConfig.componentOverrides?.JetsSeat ?? null;
  }

  /** Max nativeDeckWidth across all decks */
  get maxNativeDeckWidth(): number {
    return Math.max(...this.content.map(d => d.nativeDeckWidth ?? 0), 1);
  }

  /** Native-coordinate side space for wings/cabin titles (matches React sideSpace) */
  get sideSpaceNative(): number {
    const hasWings = this.content.some(d => d.extras?.wingsInfo?.height != null);
    const wingsW =
      this.resolvedConfig.visibleWings !== false && hasWings ? (this.resolvedConfig.colorTheme?.wingsWidth ?? 30) : 0;
    const cabinTitlesW =
      this.resolvedConfig.visibleCabinTitles !== false ? (this.resolvedConfig.colorTheme?.cabinTitlesWidth ?? 80) : 0;
    return Math.max(wingsW, cabinTitlesW);
  }

  /** Fuselage body width (config.width minus scaled side margins for wings/titles) */
  get fuselageBodyWidth(): number {
    if (!this.content.length) return this.resolvedConfig.width;
    const scale = this.content[0].scale ?? 1;
    return this.resolvedConfig.width - this.sideSpaceNative * 2 * scale;
  }

  /**
   * Per-deck floor width as a CSS percentage string.
   * Narrower decks (e.g. A380 upper deck) get a proportionally narrower
   * floor area. The fuselage fill background shows through on the sides.
   * Returns '100%' for the widest deck.
   */
  getDeckFloorWidth(deck: IDeckData): string {
    const maxNative = this.maxNativeDeckWidth;
    const deckNative = deck.nativeDeckWidth ?? maxNative;
    if (deckNative >= maxNative) return '100%';
    const pct = Math.round((deckNative / maxNative) * 100);
    return `${pct}%`;
  }

  /**
   * Gap (px) from deck-floor edge to fuselage edge on each side.
   * Used to push cabin labels outward so they appear at the fuselage, not at the floor.
   */
  getDeckCabinLabelGap(deck: IDeckData): number {
    const maxNative = this.maxNativeDeckWidth;
    const deckNative = deck.nativeDeckWidth ?? maxNative;
    if (deckNative >= maxNative) return 0;
    const floorRatio = deckNative / maxNative;
    // Total fuselage body width (excluding side margins); floor = floorRatio * bodyWidth
    // Gap on each side = (bodyWidth - floor) / 2
    return (this.fuselageBodyWidth * (1 - floorRatio)) / 2;
  }

  /**
   * Compute visible wing info for a deck (clip to deck bounds).
   * Moved from JetsDeckComponent to render wing as sibling of deck-floor
   * matching React's jets-deck-wrapper → deck-floor + JetsWing structure.
   */
  getDeckWingsInfo(deck: IDeckData): IWingsInfo | null {
    const wi = deck.extras?.wingsInfo;
    if (!wi || wi.topOffset == null || wi.height == null) return null;

    const rows = deck.rows;
    if (!rows.length) return null;

    // wi.topOffset is in React's adjusted coordinate space which includes
    // DEFAULT_DECK_TITLE_HEIGHT(80) + DEFAULT_INDEX_ROW_HEIGHT(120) = 200
    // native units. Angular handles these offsets separately, so subtract
    // React's offset to avoid double-counting.
    const REACT_FIRST_ELEMENT_OFFSET = 80 + 120;
    const adjustedTopOffset = wi.topOffset - REACT_FIRST_ELEMENT_OFFSET;

    const firstRowOffset = rows[0].topOffset ?? 0;
    const wingStart = firstRowOffset + adjustedTopOffset;
    const clippedStart = Math.max(0, wingStart);

    if (wi.height <= 0) return null;

    // Clip wing to deck bounds: don't let wings extend past the last row's bottom.
    // This prevents misplaced wings when the API returns wing coordinates for the
    // full aircraft but the deck only contains a subset of cabins (e.g. business only).
    const lastRow = rows[rows.length - 1];
    const lastRowOffset = lastRow.topOffset ?? 0;
    const lastRowNativeH = getNativeRowHeight(lastRow);
    const lastRowBottom = lastRowOffset + lastRowNativeH;

    // Wing doesn't overlap with visible rows at all — hide it
    if (clippedStart >= lastRowBottom) return null;

    // Clip wing height so it doesn't extend beyond the last row
    const clippedHeight = Math.min(wi.height, lastRowBottom - clippedStart);

    return {
      topOffset: clippedStart,
      height: clippedHeight,
      level: wi.level,
      visibleWingsLeadings: true,
    };
  }

  /**
   * Wing topAdjust from the deck-wrapper top.
   * Computes wing pixel position by walking rows and accumulating flow positions
   * (same Math.round rounding as jets-row margin-top), then interpolating the
   * wing's native start offset within the row flow grid. This avoids drift
   * between the flow-layout rows and the absolutely-positioned wing.
   */
  getDeckWingTopAdjust(deck: IDeckData): number {
    const scale = deck.scale ?? 1;
    const rows = deck.rows;
    if (!rows.length) return 0;

    // Title height (matches .jets-deck__title min-height)
    const titleHeight = this.showDeckNumbers ? 60 : 0;

    // Deck top padding (same as JetsDeckComponent.deckTopPadding)
    let minOffset = 0;
    const extras = deck.extras;
    if (extras?.bulks) {
      for (const b of extras.bulks) {
        if (b.topOffset != null && b.topOffset < minOffset) minOffset = b.topOffset;
      }
    }
    if (extras?.exits) {
      for (const e of extras.exits) {
        if (e.topOffset != null && e.topOffset < minOffset) minOffset = e.topOffset;
      }
    }
    const absMin = minOffset < 0 ? -minOffset : 0;
    const deckTopPadding = (absMin + 120) * scale;

    // Wing component computes: scaledTop = Math.round(topOffset * scale) + topAdjust
    // topOffset is already adjusted (200-unit correction) by getDeckWingsInfo().
    // topAdjust accounts for structural offsets: title + deck CSS padding + deckTopPadding.
    return titleHeight + 4 + deckTopPadding;
  }

  ngOnInit(): void {
    this.activeDeckIndex = this.currentDeckIndex;
    this._loadSeatMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentDeckIndex'] && !changes['currentDeckIndex'].firstChange) {
      this.activeDeckIndex = this.currentDeckIndex;
      this.cdr.markForCheck();
    }

    if (changes['flight'] && !changes['flight'].firstChange) {
      this._loadSeatMap();
      return;
    }

    if (changes['availability'] && !changes['availability'].firstChange && this.isSeatMapInited) {
      if (!this.availability?.length) {
        // Availability cleared — full reload restores original API seat states
        this._isSettingsReload = true;
        this._loadSeatMap();
        return;
      }
      this.content = this.seatmapService.setAvailabilityHandler(this.content, this.availability);
      this.activeTooltip = null;
      this.activeTooltipChanged.emit(null);
      this.legendReady.emit(this.legendItems);
      this.hasAvailabilityChanged.emit(this.hasAvailability);
      this.cdr.markForCheck();
    }

    if (changes['passengers'] && !changes['passengers'].firstChange && this.isSeatMapInited) {
      this._applyPassengers();
    }

    // Detect lang/units changes in config — requires full reload (API returns different text/units)
    if (changes['config'] && !changes['config'].firstChange && this.isSeatMapInited) {
      const newLang = this.config?.lang;
      const newUnits = this.config?.units;
      if ((newLang && newLang !== this._prevLang) || (newUnits && newUnits !== this._prevUnits)) {
        this._isSettingsReload = true;
        this._loadSeatMap();
        return;
      }
      // Re-emit legend when colorTheme changes (colors affect legend swatches)
      this.legendReady.emit(this.legendItems);
    }

    // seatJumpTo: scroll to and open tooltip for a specific seat. Tracked by value
    // so reassigning the same label does not re-trigger the jump.
    if (changes['seatJumpTo'] && this.isSeatMapInited) {
      const label = this.seatJumpTo?.seatLabel ?? null;
      if (label && label !== this._prevSeatJumpToLabel) {
        this._prevSeatJumpToLabel = label;
        this._jumpToSeat(label);
      } else if (!label) {
        this._prevSeatJumpToLabel = null;
      }
    }
  }

  private _jumpToSeat(seatLabel: string): void {
    const label = seatLabel.trim().toUpperCase();
    // Find seat across all decks
    for (let di = 0; di < this.content.length; di++) {
      for (const row of this.content[di].rows) {
        for (const seat of row.seats) {
          if (seat.number?.toUpperCase() === label) {
            // Switch deck if needed
            if (di !== this.activeDeckIndex) {
              this.activeDeckIndex = di;
              this.deckChanged.emit(di);
            }
            this.cdr.markForCheck();
            // Scroll into view after rendering
            setTimeout(() => {
              const el = this.mapContainer?.nativeElement?.querySelector(
                `[data-seat-number="${seat.number}"]`
              ) as HTMLElement;
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.onSeatClick({ seat, element: el });
              }
            }, 150);
            return;
          }
        }
      }
    }
  }

  ngOnDestroy(): void {
    this._flightId = null;
  }

  private _isSettingsReload = false;

  private async _loadSeatMap(): Promise<void> {
    if (!this.flight?.id) return;

    const flightId = this.flight.id;
    this._flightId = flightId;
    this.isLoading = true;
    this.activeTooltip = null;
    this.error = null;
    // Keep old content visible during settings-only reload to avoid flickering
    if (!this._isSettingsReload) {
      this.isSeatMapInited = false;
      this.content = [];
    }
    this._isSettingsReload = false;
    this.cdr.markForCheck();

    try {
      const passengersList = this.seatmapService.addAbbrToPassengers(this.passengers);
      this.passengersList = passengersList;

      const result = await this.seatmapService.getSeatMapData(
        this.flight,
        this.availability,
        passengersList,
        this.resolvedConfig
      );

      if (this._flightId !== flightId) return;

      const content = result.content;
      this.content = content;
      this.media = result.media || null;
      this.isSeatMapInited = true;
      this.isLoading = false;
      this._prevLang = this.resolvedConfig.lang;
      this._prevUnits = this.resolvedConfig.units ?? null;

      const availableSeats = this.seatmapService.collectAvailableSeats(content);
      const allSeats = this.seatmapService.collectAllSeats(content);

      // Emit initial layout data after the next tick so DOM size is measurable.
      setTimeout(() => {
        if (this._flightId !== flightId) return;
        const layout = this._buildLayoutData();
        this.seatMapInited.emit({
          ...layout,
          media: this.media,
          error: this.error ?? undefined,
          availableSeats,
          allSeats,
          availableCabins: result.availableCabins,
        });
        this.layoutUpdated.emit(layout);
      }, 0);

      this.mediaReady.emit(this.media);
      this.legendReady.emit(this.legendItems);
      this.passengersChanged.emit(this.passengersList);
      this.currencyDetected.emit(this.currencySign);
      this.hasAvailabilityChanged.emit(this.hasAvailability);
    } catch (err: any) {
      if (this._flightId !== flightId) return;
      const httpBody = err?.error ? JSON.stringify(err.error) : '';
      const msg = `HTTP ${err?.status ?? '?'}: ${err?.message ?? ''}${httpBody ? ' | ' + httpBody : ''}`;
      this.error = msg;
      this.isLoading = false;
      this.isSeatMapInited = true;
      this.loadError.emit(msg);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private _buildLayoutData(): ILayoutData {
    const rect = this.mapContainer?.nativeElement?.getBoundingClientRect();
    return {
      heightInPx: rect?.height ?? 0,
      widthInPx: rect?.width ?? this.resolvedConfig.width,
      scaleFactor: this.content[0]?.scale ?? 1,
      decksCount: this.content.length,
      currentDeckIndex: this.activeDeckIndex,
    };
  }

  private _applyPassengers(): void {
    this.passengersList = this.seatmapService.addAbbrToPassengers(this.passengers);
    this.content = this.seatmapService.setPassengersHandler(this.content, this.passengersList);
    this.activeTooltip = null;
    this.cdr.markForCheck();
  }

  onSeatMouseEnter(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    this.seatMouseEnter.emit(payload);

    // tooltipOnHover: show tooltip on hover (non-touch devices only)
    if (this.resolvedConfig.tooltipOnHover && !getEnvironmentInfo().isTouchDevice) {
      this.onSeatClick(payload);
    }
  }

  onSeatMouseLeave(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    this.seatMouseLeave.emit(payload);

    if (this.resolvedConfig.tooltipOnHover && !getEnvironmentInfo().isTouchDevice) {
      this.activeTooltip = null;
      this.activeTooltipChanged.emit(null);
      this.cdr.markForCheck();
    }
  }

  onSeatClick(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    const { seat, element, event } = payload;

    // External management + hover tooltip: emit seatMouseClick instead of showing
    // built-in tooltip. Matches React's onSeatMouseClick contract.
    const cfg = this.resolvedConfig;
    if (cfg.externalPassengerManagement && cfg.tooltipOnHover && !cfg.builtInTooltip) {
      this.seatMouseClick.emit({ seat, element, event });
      return;
    }

    const nextPassenger = this.seatmapService.getNextPassenger(this.passengersList);
    this.isSelectAvailable = !!nextPassenger;

    const tooltipData = this.seatmapService.calculateTooltipData(
      seat,
      element,
      this.mapContainer.nativeElement,
      nextPassenger,
      this.lang
    );
    this.activeTooltip = tooltipData;

    this.activeTooltipChanged.emit(this.activeTooltip);
    this.selectAvailableChanged.emit(this.isSelectAvailable);
    this.tooltipRequested.emit({ seat: this._prepareSeatForEmit(seat), element, event });
    this.cdr.markForCheck();
  }

  /**
   * Mirror of React's `prepareSeatDataForEmit`: rename `number → label` and drop
   * layout-only fields (`topOffset`, `leftOffset`, `size`, `cabinTitle`) plus the
   * internal grid id from `tooltipRequested.seat`. Integrators that build their
   * own tooltip get a payload byte-for-byte equivalent to the React lib's.
   */
  private _prepareSeatForEmit(seat: ISeatData): ISeatData {
    const {
      number,
      topOffset: _to,
      leftOffset: _lo,
      size: _sz,
      id: _id,
      cabinTitle: _ct,
      ...rest
    } = seat as ISeatData & { cabinTitle?: string };
    return { ...(rest as ISeatData), label: number };
  }

  onTooltipSelect(seat: ISeatData): void {
    const { data, passengers } = this.seatmapService.selectSeatHandler(this.content, seat, this.passengersList);
    this.content = data;
    this.passengersList = passengers;
    this.activeTooltip = null;
    this.seatSelected.emit(passengers);
    this.activeTooltipChanged.emit(null);
    this.passengersChanged.emit(passengers);
    this.legendReady.emit(this.legendItems);
    this.cdr.markForCheck();
  }

  onTooltipUnselect(seat: ISeatData): void {
    const { data, passengers } = this.seatmapService.unselectSeatHandler(this.content, seat, this.passengersList);
    this.content = data;
    this.passengersList = passengers;
    this.activeTooltip = null;
    this.seatUnselected.emit(passengers);
    this.activeTooltipChanged.emit(null);
    this.passengersChanged.emit(passengers);
    this.legendReady.emit(this.legendItems);
    this.cdr.markForCheck();
  }

  onTooltipClose(): void {
    this.activeTooltip = null;
    this.activeTooltipChanged.emit(null);
    this.cdr.markForCheck();
  }

  onMapClick(event: MouseEvent): void {
    if (!this.activeTooltip) return;
    const target = event.target as HTMLElement;
    // If click is on a seat or inside tooltip, let the seat/tooltip handler deal with it
    if (target.closest('.jets-seat--seat, .jets-tooltip')) return;
    this.onTooltipClose();
  }

  onSidePanelUnselect(seatStub: ISeatData): void {
    // Find the full seat data from content by seat number
    const seatNumber = seatStub.number;
    if (!seatNumber) return;
    for (const deck of this.content) {
      for (const row of deck.rows) {
        const seat = row.seats.find(s => s.number === seatNumber);
        if (seat) {
          this.onTooltipUnselect(seat);
          return;
        }
      }
    }
  }

  onDeckSelect(index: number): void {
    this.activeDeckIndex = index;
    this.activeTooltip = null;
    this.deckChanged.emit(index);
    this.cdr.markForCheck();
  }
}
