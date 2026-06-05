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
import { LiveAnnouncer } from '@angular/cdk/a11y';
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
import { SeatGridNavigationService, ICellPos } from '../../services/seat-grid-navigation.service';
import { JetsDeckComponent } from '../jets-deck/jets-deck.component';
import { JetsTooltipComponent } from '../jets-tooltip/jets-tooltip.component';
import { JetsNotInitComponent } from '../jets-not-init/jets-not-init.component';
import { JetsNoDataComponent } from '../jets-no-data/jets-no-data.component';
import { JetsPlaneBodyComponent } from '../jets-plane-body/jets-plane-body.component';
import { JetsDeckSelectorComponent } from '../jets-deck-selector/jets-deck-selector.component';
import { JetsDeckSeparatorComponent } from '../jets-deck-separator/jets-deck-separator.component';
import { JetsWingComponent } from '../jets-wing/jets-wing.component';
import { JetsSeatListComponent } from '../jets-seat-list/jets-seat-list.component';

// Module-scope counter for stable per-instance IDs used by ARIA wiring
// (region heading, skip-link target, deck panel/tab id pairs). Restarting
// the counter on each app load is fine — IDs only need to be unique within
// the current document, not across reloads.
let _jetsSeatMapInstanceUid = 0;
const nextSeatMapInstanceId = (): string =>
  `jets-seatmap-${++_jetsSeatMapInstanceUid}`;

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
    JetsSeatListComponent,
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

  // ─── Alternative-view (list vs grid) state ──────────────────────────────
  /**
   * User toggle override. `null` means "follow config / viewport". Set when
   * the user clicks the toggle button so a viewport resize doesn't fight
   * the user's intent.
   */
  viewOverride: 'grid' | 'list' | null = null;

  /** Tracks `matchMedia('(max-width: 480px)').matches` for `'auto'` mode. */
  private _viewportNarrow = false;
  private _viewportMql: MediaQueryList | null = null;
  private _viewportMqlListener: ((e: MediaQueryListEvent) => void) | null = null;

  // ─── Per-instance ARIA identifiers ──────────────────────────────────────
  // Generated lazily via a module-level counter so multiple seat maps on the
  // same page get distinct ids for region heading, skip-link target, and
  // tab/tabpanel wiring.
  readonly instanceId: string = nextSeatMapInstanceId();
  readonly mapHeadingId: string = `${this.instanceId}-heading`;
  readonly afterId: string = `after-${this.instanceId}`;
  readonly deckPanelIdBase: string = `${this.instanceId}-deck-panel`;

  constructor(
    private seatmapService: JetsSeatMapService,
    private cdr: ChangeDetectorRef,
    private liveAnnouncer: LiveAnnouncer,
    private gridNav: SeatGridNavigationService
  ) {}

  // ─── Grid keyboard navigation state (commit 7) ──────────────────────────
  /**
   * Currently focused cell in the seat grid. Drives roving-tabindex (the
   * cell with `tabindex=0` is the only Tab entry point; arrow keys then
   * move focus within the grid). Updated on `focusin` from any seat and
   * by `onGridKeydown` after a successful nav move.
   */
  focusedCell: ICellPos = { deckIdx: 0, rowIdx: 0, colIdx: 0 };

  // ─── Hover tooltip "hoverable" delay (commit 8 / SC 1.4.13) ─────────────
  /**
   * Pending close timer id. Scheduled by `onSeatMouseLeave` /
   * `onTooltipMouseLeave` and cancelled by `_showTooltip` or
   * `onTooltipMouseEnter` so the user can move the cursor from the seat
   * into the tooltip without it being yanked away.
   */
  private _hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Delay (ms) before a hover-tooltip is auto-closed once the cursor leaves. */
  private static readonly HOVER_CLOSE_DELAY_MS = 80;

  // ─── Tooltip dialog focus return (commit 11 / WCAG 2.4.3) ───────────────
  /**
   * The element that opened the tooltip (a seat `<div>` or list-row button).
   * Captured in `_showTooltip` and consumed by `onTooltipClose` / Select /
   * Unselect to restore keyboard focus back to the trigger when the dialog
   * goes away — same pattern as any non-modal dialog (a la `mat-menu`).
   * `null` while no tooltip is open.
   */
  private _lastTriggerElement: HTMLElement | null = null;

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

  // ─── A11y landmark / skip-link helpers ──────────────────────────────────
  /**
   * Visually-hidden <h2> text that names the region landmark. Combines a
   * localised "seat map" label with the active deck's title when present so
   * AT users hear something concrete instead of a generic "Seat map".
   * TODO(commit 17 docs): add a dedicated 'seatMap' locale key — until then
   * we synthesise the label from 'gridLabel' (added in commit 3) or fall
   * back to English.
   */
  get mapHeadingText(): string {
    const locale = LOCALES_MAP[this.lang] || LOCALES_MAP['EN'] || {};
    const base = locale['gridLabel'] || 'Seat map';
    const cabin = this.content[this.activeDeckIndex]?.title || this.content[0]?.title || '';
    return cabin ? `${base} — ${cabin}` : base;
  }

  /**
   * Label for the visually-hidden-until-focus skip link. Honours the
   * 'skipSeatmap' locale key when present; English fallback otherwise.
   * TODO(commit 17 docs): add 'skipSeatmap' to all locales.
   */
  get skipLinkLabel(): string {
    const locale = LOCALES_MAP[this.lang] || LOCALES_MAP['EN'] || {};
    return locale['skipSeatmap'] || 'Skip seat map';
  }

  /** id placed on the deck panel for aria-controls wiring from the tablist. */
  get deckPanelId(): string {
    return `${this.deckPanelIdBase}-${this.activeDeckIndex}`;
  }

  /**
   * Used by the deck panel's aria-labelledby — only meaningful in tablist
   * (N>=3) mode where the deck-selector renders real <button role="tab">
   * elements with these ids. For N<3 it points at a non-existent id which
   * AT treats as no labelledby; the section heading still names the region.
   * Kept on the panel unconditionally to keep the template simple.
   */
  get activeDeckTabId(): string {
    return `${this.deckPanelIdBase}-${this.activeDeckIndex}-tab`;
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
    // Never let the floor cover the entire fuselage interior — leave a thin
    // band on each side so colorTheme.fuselageFillColor is visible as the
    // hull lining even on single-deck planes where deck width == max.
    if (deckNative >= maxNative) return 'calc(100% - 16px)';
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
    this._initViewportWatcher();
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
      this._emitAvailabilityApplied(this.availability);
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
                const prefersReducedMotion =
                  typeof window !== 'undefined' &&
                  window.matchMedia?.('(prefers-reduced-motion: reduce)')
                    .matches;
                el.scrollIntoView({
                  behavior: prefersReducedMotion ? 'auto' : 'smooth',
                  block: 'center',
                });
                this.onSeatClick({ seat, element: el });
                this._announceMovedToSeat(seat);
              } else {
                this._announceSeatNotFound(seatLabel);
              }
            }, 150);
            return;
          }
        }
      }
    }
    // No seat matched the label in any deck.
    this._announceSeatNotFound(seatLabel);
  }

  ngOnDestroy(): void {
    this._flightId = null;
    this._teardownViewportWatcher();
    // SC 1.4.13: cancel any pending hover-close so the timer can't fire
    // against a destroyed view and emit a stray `activeTooltipChanged(null)`.
    this._cancelHoverClose();
  }

  // ─── Alternative-view (list vs grid) — commit 13 ────────────────────────

  /**
   * Resolved render mode. `config.alternativeView` wins unless the user
   * toggled manually (then `viewOverride` is used). For `'auto'` we follow
   * the live `_viewportNarrow` flag (matchMedia('(max-width: 480px)')).
   */
  get effectiveView(): 'grid' | 'list' {
    if (this.viewOverride) return this.viewOverride;
    const cfg = this.config?.alternativeView;
    if (cfg === 'list') return 'list';
    if (cfg === 'grid') return 'grid';
    // 'auto' or unset
    return cfg === 'auto' && this._viewportNarrow ? 'list' : 'grid';
  }

  /**
   * Whether the user-facing toggle button should render. We only show the
   * toggle when the host hasn't pinned `alternativeView` to a specific
   * value — pinning it means the host explicitly wants one mode.
   */
  get showViewToggle(): boolean {
    const cfg = this.config?.alternativeView;
    return cfg !== 'grid' && cfg !== 'list';
  }

  /** Localised label for the toggle button (English fallback). */
  get viewToggleLabel(): string {
    // TODO(commit 17 docs): add 'viewAsList' / 'viewAsMap' locale keys.
    return this.effectiveView === 'list' ? 'View as map' : 'View as list';
  }

  /** Flip user override; viewport changes will no longer override. */
  toggleView(): void {
    this.viewOverride = this.effectiveView === 'list' ? 'grid' : 'list';
    this.cdr.markForCheck();
  }

  private _initViewportWatcher(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this._viewportMql = window.matchMedia('(max-width: 480px)');
    this._viewportNarrow = this._viewportMql.matches;
    this._viewportMqlListener = (e: MediaQueryListEvent) => {
      this._viewportNarrow = e.matches;
      this.cdr.markForCheck();
    };
    this._viewportMql.addEventListener('change', this._viewportMqlListener);
  }

  private _teardownViewportWatcher(): void {
    if (this._viewportMql && this._viewportMqlListener) {
      this._viewportMql.removeEventListener('change', this._viewportMqlListener);
    }
    this._viewportMql = null;
    this._viewportMqlListener = null;
  }

  // ─── Grid keyboard navigation handlers (commit 7) ──────────────────────

  /**
   * Handle keydown bubbling up from any cell in the active grid. Delegates
   * the key → next-cell decision to `SeatGridNavigationService`, then
   * imperatively focuses the next cell + flips the roving tabindex. Escape
   * closes the tooltip without moving focus.
   */
  onGridKeydown(event: KeyboardEvent): void {
    // Tooltip dismiss takes precedence over grid moves.
    if (event.key === 'Escape' && this.activeTooltip) {
      this.onTooltipClose();
      event.preventDefault();
      return;
    }

    const key = this.gridNav.classifyKey(event);
    if (!key) return;

    const next = this.gridNav.move(this.focusedCell, key, this.content);
    if (next === this.focusedCell) return;

    event.preventDefault();
    event.stopPropagation();
    this.focusedCell = next;
    this._applyRovingTabindex();
    this._focusCell(next);
  }

  /**
   * Sync `focusedCell` to wherever the user actually clicked / Tab-landed.
   * Listens to bubbling `focusin` so a pointer-only user moves the roving
   * anchor too, keeping subsequent arrow nav consistent with their last
   * click.
   */
  onGridFocusin(event: FocusEvent): void {
    const el = event.target as HTMLElement | null;
    if (!el) return;
    const rowAttr = el.getAttribute?.('aria-rowindex');
    const colAttr = el.getAttribute?.('aria-colindex');
    if (rowAttr == null || colAttr == null) return;
    const rowIdx = parseInt(rowAttr, 10) - 1;
    const colIdx = parseInt(colAttr, 10) - 1;
    if (isNaN(rowIdx) || isNaN(colIdx)) return;
    this.focusedCell = { deckIdx: this.activeDeckIndex, rowIdx, colIdx };
    this._applyRovingTabindex();

    // WCAG 2.1 SC 1.4.13 — focus parity for hover tooltip.
    // Mouse users get the tooltip on mouseenter when `tooltipOnHover` is on
    // (see `onSeatMouseEnter`). Keyboard / AT users navigating the grid
    // with arrow keys (commit 7) must get the same affordance — otherwise
    // information that is "available on hover" is invisible to them.
    if (!this.resolvedConfig.tooltipOnHover) return;
    if (getEnvironmentInfo().isTouchDevice) return;

    const deck = this.content[this.focusedCell.deckIdx];
    const row = deck?.rows?.[this.focusedCell.rowIdx];
    const seat = row?.seats?.[this.focusedCell.colIdx];
    if (!seat || seat.type !== 'seat') return;
    // Only interactive seats trigger the tooltip — matches the implicit
    // contract of `_showTooltip` (which would render a tooltip with no
    // actions for non-interactive states like 'unavailable').
    const interactive =
      seat.status === 'available' ||
      seat.status === 'selected' ||
      seat.status === 'preferred' ||
      seat.status === 'extra';
    if (!interactive) return;

    // Avoid flicker / redundant emits when focus moves within the same seat
    // (e.g. focus bounces back from the tooltip).
    if (this.activeTooltip && this.activeTooltip.seat === seat) return;

    this._showTooltip({ seat, element: el });
  }

  /**
   * Walk every gridcell in the active map container and set `tabindex` so
   * exactly the focused cell carries `0` and every other carries `-1`.
   * Cheap DOM walk — at most a few hundred elements per deck.
   */
  private _applyRovingTabindex(): void {
    const container = this.mapContainer?.nativeElement;
    if (!container) return;
    const focusedRow = String(this.focusedCell.rowIdx + 1);
    const focusedCol = String(this.focusedCell.colIdx + 1);
    const cells = container.querySelectorAll<HTMLElement>('[role="gridcell"]');
    cells.forEach(cell => {
      const isFocused =
        cell.getAttribute('aria-rowindex') === focusedRow &&
        cell.getAttribute('aria-colindex') === focusedCol;
      cell.setAttribute('tabindex', isFocused ? '0' : '-1');
    });
  }

  /**
   * Imperatively focus the cell at `pos`. Uses `aria-rowindex`/`-colindex`
   * (set by commit 6) so we don't depend on having a `data-seat-number`
   * (aisle / empty cells have no seat number).
   */
  private _focusCell(pos: ICellPos): void {
    const container = this.mapContainer?.nativeElement;
    if (!container) return;
    const row = String(pos.rowIdx + 1);
    const col = String(pos.colIdx + 1);
    const el = container.querySelector<HTMLElement>(
      `[role="gridcell"][aria-rowindex="${row}"][aria-colindex="${col}"]`
    );
    el?.focus?.();
  }

  /**
   * Initialise / reset the roving anchor after a new map renders or the
   * active deck changes. Picks the first interactive seat in the active
   * deck (via `initialCell`), then applies the tabindex so Tab into the
   * grid lands on the right cell.
   */
  private _resetGridFocus(): void {
    if (!this.content?.length) return;
    this.focusedCell = this.gridNav.initialCell(this.activeDeckIndex, this.content);
    // Defer to next tick so the rendered DOM matches the new `content`.
    setTimeout(() => this._applyRovingTabindex(), 0);
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

      // Seed the roving-tabindex anchor on the first interactive seat of the
      // active deck (commit 7). The applier defers a tick so it runs after
      // the grid DOM has materialised.
      this._resetGridFocus();

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
    this.seatMouseLeave.emit(payload);

    if (this.resolvedConfig.tooltipOnHover && !getEnvironmentInfo().isTouchDevice) {
      // WCAG 2.1 SC 1.4.13 ("hoverable"): defer the close so a user moving
      // the cursor from the seat into the tooltip body has time to reach
      // it. `onTooltipMouseEnter` cancels the pending close; if the cursor
      // misses the tooltip the timer fires and the tooltip vanishes.
      this._scheduleHoverClose();
    }
  }

  /**
   * Cursor (or focus, indirectly via :focus-within) entered the tooltip body.
   * Cancels the pending hover-close timer set by `onSeatMouseLeave` so the
   * tooltip stays put for as long as the user is interacting with it.
   */
  onTooltipMouseEnter(): void {
    this._cancelHoverClose();
  }

  /**
   * Cursor left the tooltip body. Re-arm the same delayed close used by
   * `onSeatMouseLeave` so moving cursor from tooltip → off-grid still
   * dismisses the tooltip, matching the original "leaves on mouseleave"
   * behaviour but with the 80 ms grace window required by SC 1.4.13.
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

    // React parity (SeatMap.js:300-309): in hover-tooltip mode on a non-touch
    // device, an actual click in external-passenger-management mode emits
    // `seatMouseClick` instead of opening the tooltip — regardless of
    // `builtInTooltip`. The earlier `!builtInTooltip` guard was a misread of
    // the React source (the equivalent line is commented out there).
    const cfg = this.resolvedConfig;
    const shouldSelectOnClick = !!cfg.tooltipOnHover && !getEnvironmentInfo().isTouchDevice;
    if (shouldSelectOnClick && cfg.externalPassengerManagement) {
      this.seatMouseClick.emit({ seat, element, event });
      return;
    }

    this._showTooltip(payload);
  }

  private _showTooltip(payload: { seat: ISeatData; element: HTMLElement; event?: Event }): void {
    const { seat, element, event } = payload;

    // Record the element that opened the dialog so `onTooltipClose` (and the
    // Select / Unselect handlers below) can return focus to it when the
    // tooltip is dismissed (WCAG 2.4.3 Focus Order). Mirrors the standard
    // non-modal-dialog focus-return contract.
    this._lastTriggerElement = element;

    // Re-entering a seat (or focus moving back) while a hover-close was
    // pending must abort the close so we don't immediately tear down the
    // tooltip we're about to open.
    this._cancelHoverClose();

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
    this.tooltipRequested.emit({ seat, element, event });
    this.cdr.markForCheck();
  }

  onTooltipSelect(seat: ISeatData): void {
    // TODO(commit 10): announce restriction reason when select is blocked
    // (commit 10 owns the tooltip restriction-reasoning flow and will expose
    //  a hook here so we can route the reason through LiveAnnouncer).
    const nextPassenger = this.seatmapService.getNextPassenger(this.passengersList);
    const { data, passengers } = this.seatmapService.selectSeatHandler(this.content, seat, this.passengersList);
    this.content = data;
    this.passengersList = passengers;
    this.activeTooltip = null;
    this.seatSelected.emit(passengers);
    this.activeTooltipChanged.emit(null);
    this.passengersChanged.emit(passengers);
    this.legendReady.emit(this.legendItems);
    this._announceSeatSelected(seat, nextPassenger);
    this._restoreFocusToTrigger();
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
    this._announceSeatCleared(seat);
    this._restoreFocusToTrigger();
    this.cdr.markForCheck();
  }

  onTooltipClose(): void {
    this.activeTooltip = null;
    this.activeTooltipChanged.emit(null);
    this._restoreFocusToTrigger();
    this.cdr.markForCheck();
  }

  /**
   * Return keyboard focus to the seat (or list row) that opened the tooltip,
   * then clear the stored reference. Deferred via `setTimeout(0)` so the
   * tooltip DOM has time to detach before `.focus()` runs — focusing while
   * the dialog is still mounted can re-trigger an unwanted hover-open. All
   * wrapped in try/catch so a removed/disconnected trigger never throws.
   * WCAG 2.4.3 (Focus Order) — non-modal dialog focus-return contract.
   */
  private _restoreFocusToTrigger(): void {
    const trigger = this._lastTriggerElement;
    this._lastTriggerElement = null;
    if (!trigger) return;
    setTimeout(() => {
      try {
        trigger.focus({ preventScroll: true });
      } catch {
        /* no-op: jsdom / disconnected node may throw on focus options */
      }
    }, 0);
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
    // Re-anchor the roving tabindex to the first interactive seat of the new
    // deck (commit 7). Best-effort focus call via try/catch — never fail a
    // deck switch over a focus glitch.
    setTimeout(() => {
      try {
        this.focusedCell = this.gridNav.initialCell(index, this.content);
        this._applyRovingTabindex();
        this._focusCell(this.focusedCell);
      } catch {
        /* no-op: best-effort focus restoration */
      }
    }, 0);
  }

  /**
   * Skip-link click handler. Default <a href="#id"> behaviour would jump
   * but most ids on this page belong to non-focusable elements; we want the
   * after-region <span tabindex="-1"> to actually take focus so the next
   * Tab continues into the page rather than back into the seat map.
   */
  onSkipLinkClick(event: Event): void {
    event.preventDefault();
    const target = document.getElementById(this.afterId);
    if (!target) return;
    target.focus({ preventScroll: true });
    // Bring the target into view so sighted keyboard users see they jumped.
    target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }

  // ─── A11y live announcements ────────────────────────────────────────────
  //
  // All announcements use `polite` politeness — the seat-map is not an
  // emergency UI, so assertive would over-interrupt the screen reader user.
  // Strings are pulled from LOCALES_MAP via _a11yLocale() with an English
  // fallback so missing keys never silently swallow announcements.

  private _a11yLocale(): Record<string, string> {
    return LOCALES_MAP[this.lang] || LOCALES_MAP['EN'] || {};
  }

  private _announce(message: string): void {
    // LiveAnnouncer manipulates a live-region DOM node; if the host page
    // tore that down (or we fire from a stray timer after teardown) we
    // don't want the announcement failure to surface as a hard error.
    try {
      this.liveAnnouncer.announce(message, 'polite');
    } catch {
      /* no-op: announcement is best-effort */
    }
  }

  private _passengerLabel(passenger: IPassenger | null | undefined): string {
    if (!passenger) return 'passenger';
    return passenger.passengerLabel || passenger.abbr || 'passenger';
  }

  private _announceSeatSelected(seat: ISeatData, passenger: IPassenger | null | undefined): void {
    const locale = this._a11yLocale();
    const seatWord = locale['seat'] || 'Seat';
    const selectedFor = locale['seatSelectedFor'] || 'selected for';
    const number = seat.number ?? '';
    const passengerLabel = this._passengerLabel(passenger);
    const currency = seat.currency ?? '';
    const price = seat.price;
    const pricePart = price != null ? `, ${currency}${price}` : '';
    const message = `${seatWord} ${number} ${selectedFor} ${passengerLabel}${pricePart}`.trim();
    this._announce(message);
  }

  private _announceSeatCleared(seat: ISeatData): void {
    const locale = this._a11yLocale();
    const seatWord = locale['seat'] || 'Seat';
    // No dedicated `seatCleared` key in LOCALES_MAP — fall back to English
    // wording. Localised key can be added later without changing call sites.
    const clearedWord = locale['seatCleared'] || 'cleared';
    const number = seat.number ?? '';
    const message = `${seatWord} ${number} ${clearedWord}`.trim();
    this._announce(message);
  }

  private _announceMovedToSeat(seat: ISeatData): void {
    const locale = this._a11yLocale();
    // `moveToSeat` is the imperative ("Move to seat") — reuse it as the
    // base phrase; switch to a dedicated `movedToSeat` key once localised.
    const movedTo = locale['movedToSeat'] || locale['moveToSeat'] || 'Moved to seat';
    const number = seat.number ?? '';
    const message = `${movedTo} ${number}`.trim();
    this._announce(message);
  }

  private _announceSeatNotFound(label: string): void {
    const locale = this._a11yLocale();
    const seatWord = locale['seat'] || 'Seat';
    const notFound = locale['seatNotFound'] || 'not found';
    const message = `${seatWord} ${label} ${notFound}`.trim();
    this._announce(message);
  }
}
