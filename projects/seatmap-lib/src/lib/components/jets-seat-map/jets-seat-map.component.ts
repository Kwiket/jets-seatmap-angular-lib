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
  ISeatFeature,
  ISeatMouseClickData,
  ISeatMouseEnterData,
  ISeatMouseLeaveData,
  ITooltipData,
  ITooltipRequestData,
  IWingsInfo,
  TSeatAvailability,
} from '../../types';
import {
  CLASS_CODE_MAP,
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
import { JetsSeatMapPreparerService } from '../../services/jets-seat-map-preparer.service';
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
  /**
   * React parity: fired when the cursor leaves a seat **only while
   * `tooltipOnHover === true`**. In React (JetsSeat.js:128-129) the DOM
   * mouseleave listener is attached only in hover mode, so the callback
   * cannot fire outside it. Mirrors React's `onSeatMouseLeave`.
   */
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
  /** Inner wrapper that carries the horizontal `rotate(90deg)`; the cabin
   *  content lives here while the tooltip stays in the un-rotated container. */
  @ViewChild('rotor') rotor?: ElementRef<HTMLElement>;

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

  // Hover-tooltip "hoverable" delay. Without this, mouseleave on the seat
  // synchronously tears down the tooltip, so any button inside it (Select,
  // Cancel, Close) is gone before the cursor can land on it. The close is
  // scheduled instead and cancelled when the cursor enters the tooltip body.
  //
  // 300 ms covers a normal-pace cursor travel across the 12 px gap between
  // seat and tooltip (`calculateTooltipData` in jets-seat-map.service.ts).
  // A tighter window (e.g. 80 ms) was observed to drop the tooltip when a
  // user crossed the gap slowly. WCAG SC 1.4.13 allows arbitrary "user can
  // reach the content" delays as long as the close is dismissable, which
  // it is via Escape / click-outside.
  private _hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly HOVER_CLOSE_DELAY_MS = 300;

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
      colorTheme: JetsSeatMapPreparerService.mergeColorThemeWithConstraints(this.config?.colorTheme),
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
          if (seat.status === 'available' && typeof seat.price === 'number' && !seenPrices.has(seat.price)) {
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

    // Unavailable — notAvailableSeatsColor is the documented alias.
    items.push({
      label: locale['unavailable'],
      color: theme.notAvailableSeatsColor || theme.seatUnavailableColor || DEFAULT_COLOR_THEME.seatUnavailableColor,
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
   * Display scale matching React's `params.scale` (data-helper.js:21,154-159):
   *   scale = config.width / (max(deck.width) + fuselageStrokeWidth*2)
   *
   * React applies this as a CSS `transform: scale` / `zoom` on the seat-map
   * wrapper (`SeatMap.js:426-439`), so every CSS px inside renders at
   * `value * scale`. We don't restructure the DOM into a scaled wrapper —
   * instead we pre-multiply the body border and the deck-floor lining by
   * this value, which is what the user perceptually compares (border /
   * lining thickness) against the React storybook. Rows are already
   * pre-scaled by the preparer itself.
   *
   * Returns 1 when no decks (matches React `|| 1` fallback) or no stroke.
   */
  get displayScale(): number {
    if (!this.content.length) return 1;
    const stroke = this.resolvedConfig.colorTheme?.fuselageStrokeWidth ?? 0;
    // Match React `data-helper.js:16,21`: scale = config.width / (max(deck.width) + stroke*2).
    // React's `deck.width` is the seats-only row width (aisles are zero when
    // computed with `maxRowWidth=0`), so we use `biggestSeatRowWidth` and NOT
    // `nativeDeckWidth` here — keeping displayScale denominator independent
    // of the aisle-inflated row-layout metric.
    const maxNative = Math.max(...this.content.map(d => d.biggestSeatRowWidth ?? d.nativeDeckWidth ?? 0));
    if (maxNative <= 0) return 1;
    return this.resolvedConfig.width / (maxNative + stroke * 2);
  }

  /**
   * Per-deck floor width as a CSS percentage string. The widest deck fills
   * the fuselage interior edge-to-edge (matches React PlaneBody/index.js,
   * where the deck-floor is 100 % of the body inner). Narrower decks (e.g.
   * A380 upper) shrink proportionally and let the body fill color show on
   * the sides.
   */
  getDeckFloorWidth(deck: IDeckData): string {
    const maxNative = this.maxNativeDeckWidth;
    const deckNative = deck.nativeDeckWidth ?? maxNative;
    if (deckNative >= maxNative) return '100%';
    const pct = Math.round((deckNative / maxNative) * 100);
    return `${pct}%`;
  }

  /**
   * `fuselageFillColor`-painted side lining on `.deck-floor` — mirrors React's
   * `borderWidth = max((innerWidth - deck.width)*0.5 - fuselageStrokeWidth, fuselageStrokeWidth)`
   * in `PlaneBody/index.js:88-92`. With box-sizing: border-box on the floor,
   * the border carves the inside, leaving a thin coloured strip between the
   * green fuselage outline and the dark cabin floor.
   *
   * Mirrors React's NaN-fallthrough: when `fuselageStrokeWidth` is undefined
   * the React formula returns NaN and the CSS border collapses to 0; we do
   * the same explicitly so the floor stays edge-to-edge of the body interior.
   */
  getDeckFloorLiningWidth(deck: IDeckData): number {
    const stroke = this.resolvedConfig.colorTheme?.fuselageStrokeWidth;
    if (typeof stroke !== 'number' || stroke <= 0) return 0;
    // The preparer's _computeDeckScale now reserves 4× the stroke (border +
    // lining) so the rendered deckWidth always fits inside the body interior
    // minus the lining. The React formula
    // `max((innerW - deck.width)*0.5 - fuselageStrokeWidth, fuselageStrokeWidth)`
    // simplifies here to `max(slack, stroke)` because the body border is
    // already carved out by `box-sizing: border-box`.
    //
    // Multiply by displayScale so the visible lining matches React's
    // CSS-zoom-scaled rendering — same as scaledStrokeWidth on the body.
    const innerW = this.fuselageBodyWidth - 2 * stroke;
    const deckW = deck.deckWidth ?? innerW;
    return Math.max((innerW - deckW) * 0.5, stroke) * this.displayScale;
  }

  getDeckFloorLiningColor(): string {
    return this.resolvedConfig.colorTheme?.fuselageFillColor ?? DEFAULT_COLOR_THEME.fuselageFillColor;
  }

  /**
   * Distance (px) the cabin label is pushed outward from its in-flow
   * anchor (the deck-floor right/left edge).
   *
   * Two independent contributions are summed:
   *
   *  - **Narrow-deck adjustment** — when the deck-floor is narrower than the
   *    widest deck (e.g. A380 upper) we push the label outward by the gap
   *    between deck-floor edge and fuselage edge so the label still appears
   *    at the fuselage, not at the deck floor.
   *
   *  - **`cabinTitlesWidth` push** — the consumer-controlled `cabinTitlesWidth`
   *    sets aside `cabinTitlesWidth*scale` px of side space outside the
   *    fuselage. Without this push the label would hug the fuselage edge and
   *    the consumer would see no visual effect from increasing
   *    `cabinTitlesWidth` (a React-parity regression: in the React lib a
   *    bigger `cabinTitlesWidth` clearly increases the gap between the label
   *    and the body). The push moves the label so its outer edge lands near
   *    the seatmap wrapper edge, leaving the cabin-title gutter visibly empty
   *    between the body and the label.
   */
  getDeckCabinLabelGap(deck: IDeckData): number {
    const maxNative = this.maxNativeDeckWidth;
    const deckNative = deck.nativeDeckWidth ?? maxNative;
    const floorRatio = deckNative >= maxNative ? 1 : deckNative / maxNative;
    const narrowDeckGap = (this.fuselageBodyWidth * (1 - floorRatio)) / 2;

    // `cabinTitlesWidth*scale` is the rendered cabin-title gutter width on
    // each side. The label is `LABEL_WIDTH` px wide and we want it to sit
    // `OUTER_INSET` px inside the wrapper edge, so the gap between the body
    // and the label is whatever is left over — directly proportional to the
    // consumer-set `cabinTitlesWidth`. Clamped to 0 so a small
    // cabinTitlesWidth (or one dominated by a larger wingsWidth) doesn't
    // pull the label INSIDE the body. The existing 8 px constant in the
    // label's CSS `right: calc(100% + 8px + …)` cancels out the deck-floor
    // border offset; it does NOT contribute to the outward push, so we do
    // not subtract it here.
    const scale = this.content.length ? (this.content[0].scale ?? 1) : 1;
    const cabinTitlesPx = (this.resolvedConfig.colorTheme?.cabinTitlesWidth ?? 0) * scale;
    const LABEL_WIDTH = 20;
    const OUTER_INSET = 4;
    const cabinTitlesPush = Math.max(0, cabinTitlesPx - LABEL_WIDTH - OUTER_INSET);

    return narrowDeckGap + cabinTitlesPush;
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
      // Ignore out-of-range deck indices so an invalid integrator value doesn't
      // collapse `visibleDecks` to an empty list and render an empty fuselage.
      const idx = this.currentDeckIndex;
      if (Number.isInteger(idx) && idx >= 0 && idx < this.content.length) {
        this.activeDeckIndex = idx;
        this.cdr.markForCheck();
        this._emitLayoutUpdated();
      }
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
      this._emitAvailabilityApplied(this.availability);
      this.cdr.markForCheck();
    }

    if (changes['passengers'] && !changes['passengers'].firstChange && this.isSeatMapInited) {
      this._applyPassengers();
    }

    // Detect config changes that require a full re-prep.
    //   - lang / units: API returns different text/units, must refetch.
    //   - customCabinTitles: cabin labels are baked into row.cabinTitle by the
    //     preparer, so a stale prep keeps the previous titles in the DOM even
    //     though the new config object is in place.
    // Important: we *don't* gate this on `isSeatMapInited` — an integrator may
    // swap config while the initial load is still in-flight (e.g. e2e test
    // setup), and the stale in-flight prep would otherwise win on completion.
    // `_loadSeatMap` itself is guarded by a load-id so the second call cleanly
    // supersedes the first.
    if (changes['config'] && !changes['config'].firstChange) {
      const newLang = this.config?.lang;
      const newUnits = this.config?.units;
      const prevConfig = changes['config'].previousValue as IConfig | undefined;
      const customCabinTitlesChanged =
        JSON.stringify(prevConfig?.customCabinTitles) !== JSON.stringify(this.config?.customCabinTitles);
      if (
        (newLang && newLang !== this._prevLang) ||
        (newUnits && newUnits !== this._prevUnits) ||
        customCabinTitlesChanged
      ) {
        this._isSettingsReload = true;
        this._loadSeatMap();
        return;
      }
      // Re-emit legend when colorTheme changes (colors affect legend swatches)
      if (this.isSeatMapInited) this.legendReady.emit(this.legendItems);
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
              this._emitLayoutUpdated();
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
    this._cancelHoverClose();
  }

  private _isSettingsReload = false;
  // Monotonic load counter. Each `_loadSeatMap` call captures the current
  // value at start and re-checks it after the async fetch. If a newer load
  // has been kicked off in the meantime, the older result is discarded.
  private _loadId = 0;

  private async _loadSeatMap(): Promise<void> {
    if (!this.flight?.id) return;

    const loadId = ++this._loadId;
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
      // If another _loadSeatMap kicked off while this one was awaiting (e.g.
      // a config change landed during the initial in-flight load), the newer
      // call owns the final state. Drop the stale result.
      if (this._loadId !== loadId) return;

      // If availability / passengers landed via @Input() while the
      // `getSeatMapData` fetch was awaiting, the result.content was prepared
      // with the *captured* values (likely the initial empty/undefined ones).
      // Re-apply the current inputs so the post-load DOM reflects them —
      // ngOnChanges' setAvailabilityHandler/applyPassengers branches were
      // gated on `isSeatMapInited` and got skipped during the in-flight
      // window. Both handlers are idempotent.
      let content = result.content;
      if (this.availability?.length) {
        content = this.seatmapService.setAvailabilityHandler(content, this.availability);
      }
      const lateList = this.seatmapService.addAbbrToPassengers(this.passengers);
      if (lateList?.length) {
        content = this.seatmapService.setPassengersHandler(content, lateList);
        this.passengersList = lateList;
      }
      this.content = content;
      this.media = result.media || null;
      this.isSeatMapInited = true;
      this.isLoading = false;
      this._prevLang = this.resolvedConfig.lang;
      this._prevUnits = this.resolvedConfig.units ?? null;

      // Emit initial layout data after the next tick so DOM size is measurable.
      setTimeout(() => {
        if (this._flightId !== flightId) return;
        const layout = this._buildLayoutData();
        const payload: IInitialLayoutData = {
          ...layout,
          media: this.media,
          // `availabilityData` is the read-only `{availableSeats: […]}` block
          // surfaced by the Quicket API itself (see
          // `JetsSeatMapApiService._postSeatmap`). Do not confuse with the
          // integrator-supplied `availability` Input — that one drives per-
          // seat status/colour overrides and lives in a different shape.
          availabilityData: result.availabilityData,
          allCabins: result.availableCabins,
        };
        // React parity: omit the `error` key entirely when there is no error.
        if (this.error) payload.error = this.error;
        this.seatMapInited.emit(payload);
        this.layoutUpdated.emit(layout);
      }, 0);

      this.mediaReady.emit(this.media);
      this.legendReady.emit(this.legendItems);
      this.passengersChanged.emit(this.passengersList);
      this.currencyDetected.emit(this.currencySign);
      this.hasAvailabilityChanged.emit(this.hasAvailability);
      if (this.availability?.length) {
        this._emitAvailabilityApplied(this.availability);
      }
    } catch (err: any) {
      if (this._flightId !== flightId) return;
      // React parity: `postData: {status} - {message}` — see jets-seatmap React lib.
      // Prefer the API body message (HttpErrorResponse.error.message) over the
      // generic transport message ('Http failure response …') so callers see
      // the actual validation failure surfaced by the backend.
      const status = err?.status ?? '?';
      const message = err?.error?.message ?? err?.message ?? '';
      const msg = `postData: ${status} - ${message}`;
      this.error = msg;
      this.isLoading = false;
      this.isSeatMapInited = true;
      this.loadError.emit(msg);
      // React parity: emit `seatMapInited` with `error` and undefined layout
      // fields, so consumers wiring only onSeatMapInited still receive errors.
      // Keys are present with `undefined` values to mirror React's payload
      // shape (visible in the React lib's console.log output).
      this.seatMapInited.emit({
        heightInPx: undefined,
        widthInPx: undefined,
        scaleFactor: undefined,
        decksCount: undefined,
        currentDeckIndex: undefined,
        error: msg,
      });
    } finally {
      this.cdr.markForCheck();
    }
  }

  private _buildLayoutData(): ILayoutData {
    // Measure the rotor (the element that carries the rotation/scale) so the
    // layout payload is unchanged by moving the transform off the container.
    const container = this.rotor?.nativeElement ?? this.mapContainer?.nativeElement;
    // heightInPx must reflect the active deck only, not the stacked total (README contract).
    const activeDeckEl = container?.querySelector(
      `.deck-wrapper[data-deck-index="${this.activeDeckIndex}"]`
    ) as HTMLElement | null;
    const deckRect = activeDeckEl?.getBoundingClientRect();
    const containerRect = container?.getBoundingClientRect();
    const scaleFactor = this.content[this.activeDeckIndex]?.scale ?? 1;
    const renderedHeight = deckRect?.height ?? containerRect?.height ?? 0;
    const renderedWidth = containerRect?.width ?? this.resolvedConfig.width;
    // Public contract: heightInPx/widthInPx are NATIVE (unscaled).
    // Invariant: native × scaleFactor === actual rendered pixels.
    // Matches React's data-helper.js (`params.scale = config.width / nativeWidth`).
    return {
      heightInPx: scaleFactor > 0 ? renderedHeight / scaleFactor : renderedHeight,
      widthInPx: scaleFactor > 0 ? renderedWidth / scaleFactor : renderedWidth,
      scaleFactor,
      decksCount: this.content.length,
      currentDeckIndex: this.activeDeckIndex,
    };
  }

  // setTimeout defers to next CD pass so DOM reflects new activeDeckIndex; flightId guards races with flight swap.
  private _emitLayoutUpdated(): void {
    const flightId = this._flightId;
    setTimeout(() => {
      if (this._flightId !== flightId || !this.isSeatMapInited) return;
      this.layoutUpdated.emit(this._buildLayoutData());
    }, 0);
  }

  getDeckIndex(deck: IDeckData): number {
    return this.content.indexOf(deck);
  }

  private _emitAvailabilityApplied(availability: TSeatAvailability): void {
    const labels = availability.map(item => item.label).filter(label => label !== '*');
    const info = this.seatmapService.compareWithDecksSeatsInfo(labels, this.content);
    this.availabilityApplied.emit(info);
  }

  private _applyPassengers(): void {
    this.passengersList = this.seatmapService.addAbbrToPassengers(this.passengers);
    this.content = this.seatmapService.setPassengersHandler(this.content, this.passengersList);
    this.activeTooltip = null;
    this.cdr.markForCheck();
  }

  onSeatMouseEnter(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    this.seatMouseEnter.emit(payload);

    // tooltipOnHover: show tooltip on hover (non-touch devices only).
    // Mirrors React's JetsSeat.js, where mouseEnter goes straight through
    // `showTooltip` and never through the click-handler — so hover does NOT
    // emit `seatMouseClick` even in external+hover mode.
    if (this.resolvedConfig.tooltipOnHover && !getEnvironmentInfo().isTouchDevice) {
      this._showTooltip(payload);
    }
  }

  onSeatMouseLeave(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    // React parity (JetsSeat.js:128-129, SeatMap.js:408-414): the outward
    // `onSeatMouseLeave` only fires in hover-tooltip mode. In React the DOM
    // mouseleave listener itself is attached only when `tooltipOnHover === true`;
    // here the listener is always wired, so we gate the emit at this layer.
    if (!this.resolvedConfig.tooltipOnHover) return;

    // Emit the same enriched shape integrators see in tooltipRequested /
    // seatMouseClick — React-parity (JetsSeat.js routes both hover & click
    // through prepareSeatDataForEmit). Without this pass, mouseLeave would
    // hand back the raw internal seat (single-letter classType, numeric
    // price, missing passengerTypes/additionalProps).
    const { seat, element, event } = payload;
    this.seatMouseLeave.emit({ seat: this._prepareSeatForEmit(seat), element, event });

    if (!getEnvironmentInfo().isTouchDevice) {
      // Defer the close so the cursor has time to reach the tooltip body —
      // `onTooltipMouseEnter` cancels the pending close. Without this, the
      // tooltip is torn out of the DOM before any in-tooltip button can be
      // clicked.
      this._scheduleHoverClose();
    }
  }

  /**
   * Cursor entered the tooltip body. Cancel the pending hover-close so the
   * tooltip stays put while the user is interacting with it (clicking on
   * Select / Cancel / Close buttons).
   */
  onTooltipMouseEnter(): void {
    this._cancelHoverClose();
  }

  /**
   * Cursor left the tooltip body. Re-arm the delayed close so moving the
   * cursor off the tooltip (without going back to the seat) still dismisses
   * it — matching the original "leaves on mouseleave" behaviour but with a
   * grace window the cursor can use to travel between the two elements.
   */
  onTooltipMouseLeave(): void {
    if (!this.resolvedConfig.tooltipOnHover) return;
    if (getEnvironmentInfo().isTouchDevice) return;
    this._scheduleHoverClose();
  }

  private _scheduleHoverClose(): void {
    this._cancelHoverClose();
    this._hoverCloseTimer = setTimeout(() => {
      this._hoverCloseTimer = null;
      this.activeTooltip = null;
      this.activeTooltipChanged.emit(null);
      this.cdr.markForCheck();
    }, JetsSeatMapComponent.HOVER_CLOSE_DELAY_MS);
  }

  private _cancelHoverClose(): void {
    if (this._hoverCloseTimer != null) {
      clearTimeout(this._hoverCloseTimer);
      this._hoverCloseTimer = null;
    }
  }

  onSeatClick(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    const { seat, element, event } = payload;

    // React parity (SeatMap.js:299-325): in hover-tooltip mode on a non-touch
    // device, an actual click bypasses the tooltip and either delegates to the
    // integrator (`externalPassengerManagement: true` → emit `seatMouseClick`)
    // or directly (un)selects the seat internally — regardless of
    // `builtInTooltip`. The non-hover path keeps opening the tooltip as before.
    const cfg = this.resolvedConfig;
    const shouldSelectOnClick = !!cfg.tooltipOnHover && !getEnvironmentInfo().isTouchDevice;

    if (shouldSelectOnClick) {
      if (cfg.externalPassengerManagement) {
        // React-parity payload contract: route through _prepareSeatForEmit so
        // integrators receive the same enriched shape that tooltipRequested
        // and seatMouseLeave do.
        this.seatMouseClick.emit({ seat: this._prepareSeatForEmit(seat), element, event });
        return;
      }
      // Built-in passenger management. Mirrors React's SeatMap.js:311-321:
      // an occupied seat unselects (unless the occupant is readOnly), an empty
      // seat selects if there's a compatible next passenger waiting. No
      // tooltip is opened and no `tooltipRequested` is emitted — that branch
      // belongs to the non-hover click path only.
      if (seat.passenger) {
        if (seat.passenger.readOnly) return;
        this.onTooltipUnselect(seat);
        return;
      }
      if (this._isSeatSelectDisabled(seat)) return;
      this.onTooltipSelect(seat);
      return;
    }

    this._showTooltip(payload);
  }

  /**
   * React parity for SeatMap.js:416-424. A seat is "select-disabled" when
   * either there's no next passenger queued, or the next passenger's
   * `passengerType` is not in the seat's `passengerTypes` whitelist.
   */
  private _isSeatSelectDisabled(seat: ISeatData): boolean {
    const nextPassenger = this.seatmapService.getNextPassenger(this.passengersList);
    if (!nextPassenger) return true;
    return !!(
      nextPassenger.passengerType &&
      seat.passengerTypes?.length &&
      !seat.passengerTypes.includes(nextPassenger.passengerType)
    );
  }

  private _showTooltip(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    const { seat, element, event } = payload;

    // Re-entering a seat while a hover-close was pending must abort the
    // close so we don't immediately tear down the tooltip we're about to
    // open.
    this._cancelHoverClose();

    const nextPassenger = this.seatmapService.getNextPassenger(this.passengersList);
    this.isSelectAvailable = !!nextPassenger;

    const tooltipData = this.seatmapService.calculateTooltipData(
      seat,
      element,
      this.mapContainer.nativeElement,
      nextPassenger,
      this.lang,
      this.resolvedConfig.horizontal ?? false
    );
    this.activeTooltip = tooltipData;

    this.activeTooltipChanged.emit(this.activeTooltip);
    this.selectAvailableChanged.emit(this.isSelectAvailable);
    this.tooltipRequested.emit({ seat: this._prepareSeatForEmit(seat), element, event });
    this.cdr.markForCheck();
  }

  /**
   * Build the public `tooltipRequested.seat` payload from the lib's internal
   * seat record. Mirrors React's `prepareSeatDataForEmit` and is then enriched
   * to match the documented integrator contract:
   *
   *   - `label`     ← `number`
   *   - `classType` ← `CLASS_CODE_MAP[classCode]` (full word, e.g. 'Business')
   *   - `priceValue` ← raw numeric price
   *   - `price`     ← formatted '${currency} ${priceValue}' string
   *   - `features[].title` and `features[].value` are coerced to strings so
   *     negative amenities (which carry `title: null` internally) still satisfy
   *     `ISeatFeature.{ title: string, value: string }` in the public type.
   *
   * Stripped: `id`, `topOffset`, `leftOffset`, `size`, `number`, `cabinTitle`
   * — layout-only or renamed fields not part of the public contract.
   */
  private _prepareSeatForEmit(seat: ISeatData): ISeatData {
    const {
      number,
      topOffset: _to,
      leftOffset: _lo,
      size: _sz,
      id: _id,
      cabinTitle: _ct,
      rotation,
      classCode,
      color,
      originalColor,
      price,
      currency,
      features,
      measurements,
      ...rest
    } = seat as ISeatData & { cabinTitle?: string };

    // React-parity: every emitted seat carries `rotation` with `'n'` (north /
    // no-rotation) as the default — see Seat/__fixtures__/seatData.js. The
    // earlier "drop the field" approach matched the wrong seat (an unrotated
    // 70E) and was a regression for any integrator inspecting the payload
    // shape. Normalise the legacy empty-string to `'n'` here.
    const emittedRotation = !rotation || (rotation as string) === '' ? 'n' : rotation;

    // `classType` becomes the full word ('Business'), `classCode` stays single-letter.
    const code = (classCode || rest.classType || 'E').toString();
    const classTypeFull = CLASS_CODE_MAP[code.toLowerCase()] || CLASS_CODE_MAP[code] || code;

    // Defensive fallback: the contract is `color: string` (not optional). The
    // availability handler was the historic culprit that produced `color:
    // undefined`; even though that's now fixed, fall back through
    // `originalColor` → theme's seat-available colour → DEFAULT_COLOR_THEME so
    // a downstream regression cannot ship an undefined colour again.
    const theme = this.resolvedConfig.colorTheme ?? {};
    const resolvedColor = color ?? originalColor ?? theme.seatAvailableColor ?? DEFAULT_COLOR_THEME.seatAvailableColor;

    // React-parity feature shape: `title` stays as the localized category
    // label, `value` stays as either the raw API summary (string) or the
    // existence flag (`true`). Negative amenities carry `title: null`
    // internally — collapse those onto `value` so the public ISeatFeature
    // still has a non-null title, but leave positive amenities' `value`
    // untouched (don't coerce `true` → `"true"`).
    const normalizeFeature = (f: ISeatFeature): ISeatFeature =>
      f.title == null ? { ...f, title: typeof f.value === 'string' ? f.value : '' } : f;

    const numericPrice = typeof price === 'number' ? price : undefined;
    const priceStr = numericPrice != null ? `${currency ?? ''}${currency ? ' ' : ''}${numericPrice}` : undefined;

    // React-parity: when the API/availability don't restrict the seat, fall
    // back to DEFAULT_SEAT_PASSENGER_TYPES (`['ADT', 'CHD', 'INF']`) — see
    // jets-seatmap-react-lib-pub/src/common/constants.js:121 + service.js:100.
    const passengerTypes = (rest as ISeatData).passengerTypes ?? ['ADT', 'CHD', 'INF'];

    const emitted = {
      ...(rest as ISeatData),
      label: number,
      classCode: code,
      classType: classTypeFull,
      color: resolvedColor,
      originalColor: originalColor ?? resolvedColor,
      currency,
      // `price` becomes the formatted string; `priceValue` carries the number.
      price: priceStr as unknown as number,
      priceValue: numericPrice,
      passengerTypes,
      rotation: emittedRotation,
      features: (features ?? []).map(normalizeFeature),
      measurements: (measurements ?? []).map(normalizeFeature),
      additionalProps: ((rest as ISeatData).additionalProps ?? []).map(normalizeFeature),
    };

    // Strip any remaining undefined-valued keys so the payload only carries
    // fields the lib actually has data for. Mirrors how integrators would
    // hand-craft a JSON contract — present keys mean "set", missing keys
    // mean "unset" — instead of `{ price: undefined }` style noise.
    for (const k of Object.keys(emitted) as Array<keyof typeof emitted>) {
      if (emitted[k] === undefined) delete emitted[k];
    }
    return emitted;
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
    // React parity: readOnly occupants cannot be unseated through the built-in
    // tooltip path. The Unselect button is rendered disabled, but we guard the
    // handler too in case a viewOverride bypasses the disabled attribute or the
    // call arrives from the side-panel delegation path.
    if (seat.passenger?.readOnly) return;
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
    this._emitLayoutUpdated();
  }
}
